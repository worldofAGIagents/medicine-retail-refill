import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';
import { detectMedicineCategory, normalizeChronicCategory, DEFAULT_CHRONIC_CATEGORY } from '@/lib/medicine-classifier';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      altPhone,
      address,
      locality,
      city = 'Muzaffarpur',
      primaryCondition: rawCondition,
      condition,
      medicines: inputMedicines,
      medicineId,
      dailyDosage = 1,
      lastPurchaseQty: rawQty,
      quantityPurchased,
      lastPurchaseDate,
      bufferDays = 3,
      doctorName,
      customPackaging,
      unitType = 'tablets',
    } = body;

    const primaryCondition = normalizeChronicCategory(rawCondition || condition);

    if (!name || !phone) {
      return NextResponse.json({ error: 'Patient name and phone number are required' }, { status: 400 });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
    }

    const cleanAltPhone = altPhone ? String(altPhone).replace(/[^0-9]/g, '').slice(-10) : null;

    // 1. Create or update customer with primary condition and village details
    const customer = await db.customer.upsert({
      where: { phone: cleanPhone },
      update: {
        name,
        altPhone: cleanAltPhone || undefined,
        address: address || undefined,
        locality: locality || undefined,
        city: city || 'Muzaffarpur',
        primaryCondition,
        whatsappEnabled: true,
        consentGiven: true,
      },
      create: {
        name,
        phone: cleanPhone,
        altPhone: cleanAltPhone,
        address: address || 'Sarfuddinpur, Muzaffarpur',
        locality: locality || 'Sarfuddinpur',
        city: city || 'Muzaffarpur',
        primaryCondition,
        whatsappEnabled: true,
        consentGiven: true,
      },
    });

    const createdPrescriptions: any[] = [];
    let updatedCount = 0;

    // 2. Normalise medicines list: either array from inputMedicines or single medicineId
    const medList: any[] = [];
    if (Array.isArray(inputMedicines) && inputMedicines.length > 0) {
      medList.push(...inputMedicines);
    } else if (medicineId) {
      medList.push({
        medicineId,
        dailyDosage: Number(dailyDosage) || 1,
        lastPurchaseQty: Number(rawQty || quantityPurchased) || 30,
        lastPurchaseDate,
        bufferDays: Number(bufferDays) || 3,
        doctorName,
        customPackaging,
        unitType,
      });
    }

    // Deduplicate medList by medicineId to guarantee zero duplicate prescriptions
    const uniqueMedMap = new Map<string, any>();
    for (const item of medList) {
      if (item.medicineId) {
        uniqueMedMap.set(item.medicineId, item);
      }
    }
    const dedupedMedList = Array.from(uniqueMedMap.values());

    // 3. Process each medicine: dynamically categorize & create prescription
    for (const item of dedupedMedList) {
      if (!item.medicineId) continue;
      const med = await db.medicine.findUnique({ where: { id: item.medicineId } });
      if (!med) continue;

      // DYNAMIC LEARNING & CUSTOM OVERRIDES: Update medicine MRP, packaging & chronic category
      const medUpdates: any = {};
      if (item.customMrp && Number(item.customMrp) > 0) {
        medUpdates.mrp = Number(item.customMrp);
      }
      if (item.customUnitsPerPack && Number(item.customUnitsPerPack) > 0) {
        medUpdates.unitsPerPack = Number(item.customUnitsPerPack);
      }
      
      // Dynamic category learning:
      // If medicine item has an explicit category, use it. Otherwise detect dynamically.
      // If unclassified or deselected, default to 'Blood Pressure'.
      const learnedCat = item.category || detectMedicineCategory(med.name, med.genericName, med.saltComposition);
      if (!med.category || med.category === 'General' || med.category === 'Uncategorized' || item.category) {
        medUpdates.category = learnedCat || DEFAULT_CHRONIC_CATEGORY;
      }
      medUpdates.isChronicMed = true;

      if (Object.keys(medUpdates).length > 0) {
        await db.medicine.update({
          where: { id: item.medicineId },
          data: medUpdates,
        });
        updatedCount++;
      }

      // Calculate refill dates
      const purchaseDateObj = item.lastPurchaseDate ? new Date(item.lastPurchaseDate) : new Date();
      const qty = Number(item.lastPurchaseQty || item.quantityPurchased) || 30;
      const dose = Number(item.dailyDosage) || 1;
      const buffer = Number(item.bufferDays) || 3;

      const refillCalc = calculateRefill({
        lastPurchaseDate: purchaseDateObj,
        lastPurchaseQty: qty,
        dailyDosage: dose,
        bufferDays: buffer,
        medicineName: med.name,
        category: medUpdates.category || med.category,
        packagingType: med.packagingType,
        unitType: item.unitType,
        customPackaging: item.customPackaging,
      });

      const prescriptionData = {
        dailyDosage: dose,
        lastPurchaseDate: purchaseDateObj,
        lastPurchaseQty: qty,
        nextRefillDate: refillCalc.nextRefillDate,
        bufferDays: buffer,
        doctorName: item.doctorName || doctorName || null,
        customPackaging: item.customPackaging || (refillCalc.isSyrup ? '1 Bottle (Syrup)' : primaryCondition === 'Infant Milk' ? '400g Tin' : `${med.unitsPerPack} tabs/strip`),
        unitType: refillCalc.isSyrup ? (item.unitType || 'ml') : primaryCondition === 'Infant Milk' ? 'grams' : (item.unitType || 'tablets'),
        isActive: true,
      };

      // Check for existing active prescription for this medicine to avoid duplicates
      const existingPrescription = await db.prescription.findFirst({
        where: {
          customerId: customer.id,
          medicineId: item.medicineId,
          isActive: true,
        },
      });

      let presc;
      if (existingPrescription) {
        presc = await db.prescription.update({
          where: { id: existingPrescription.id },
          data: prescriptionData,
          include: { medicine: true },
        });

        // Clean up any historical duplicate prescriptions for this customer & medicine
        const duplicates = await db.prescription.findMany({
          where: {
            customerId: customer.id,
            medicineId: item.medicineId,
            id: { not: existingPrescription.id },
          },
        });
        if (duplicates.length > 0) {
          await db.prescription.deleteMany({
            where: { id: { in: duplicates.map((d) => d.id) } },
          });
        }
      } else {
        presc = await db.prescription.create({
          data: {
            customerId: customer.id,
            medicineId: item.medicineId,
            ...prescriptionData,
          },
          include: { medicine: true },
        });
      }

      createdPrescriptions.push(presc);
    }

    return NextResponse.json({
      success: true,
      customer,
      prescription: createdPrescriptions[0] || null,
      prescriptions: createdPrescriptions,
      medicineUpdated: updatedCount > 0,
      updatedMedicinesCount: updatedCount,
      message: `Patient ${customer.name} onboarded with ${createdPrescriptions.length} medicine(s) successfully!`,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Error onboarding patient' }, { status: 500 });
  }
}
