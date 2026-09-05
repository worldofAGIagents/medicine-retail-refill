import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

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

    const primaryCondition = rawCondition || condition || 'General';

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

    // 3. Process each medicine: dynamically categorize & create prescription
    for (const item of medList) {
      if (!item.medicineId) continue;
      const med = await db.medicine.findUnique({ where: { id: item.medicineId } });
      if (!med) continue;

      // DYNAMIC LEARNING: Tag this medicine with the customer's condition & mark as chronic
      if (primaryCondition && primaryCondition !== 'General') {
        await db.medicine.update({
          where: { id: item.medicineId },
          data: {
            category: primaryCondition,
            isChronicMed: true,
          },
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
      });

      const presc = await db.prescription.create({
        data: {
          customerId: customer.id,
          medicineId: item.medicineId,
          dailyDosage: dose,
          lastPurchaseDate: purchaseDateObj,
          lastPurchaseQty: qty,
          nextRefillDate: refillCalc.nextRefillDate,
          bufferDays: buffer,
          doctorName: item.doctorName || doctorName || null,
          customPackaging: item.customPackaging || (primaryCondition === 'Infant Milk' ? '400g Tin' : `${med.unitsPerPack} tabs/strip`),
          unitType: primaryCondition === 'Infant Milk' ? 'grams' : (item.unitType || 'tablets'),
          isActive: true,
        },
        include: {
          medicine: true,
        },
      });
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
    }, { status: 201 });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Error onboarding patient' }, { status: 500 });
  }
}
