import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      address,
      locality,
      city = '',
      primaryCondition = 'General',
      medicineId,
      dailyDosage = 1,
      lastPurchaseQty = 30,
      lastPurchaseDate,
      bufferDays = 3,
      doctorName,
      customPackaging,
      unitType = 'tablets',
    } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Patient name and phone number are required' }, { status: 400 });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
    }

    // 1. Create or update customer with primary condition
    const customer = await db.customer.upsert({
      where: { phone: cleanPhone },
      update: {
        name,
        address: address || undefined,
        locality: locality || undefined,
        city: city || undefined,
        primaryCondition,
        whatsappEnabled: true,
        consentGiven: true,
      },
      create: {
        name,
        phone: cleanPhone,
        address: address || 'Local Customer',
        locality: locality || '',
        city: city || '',
        primaryCondition,
        whatsappEnabled: true,
        consentGiven: true,
      },
    });

    let prescription = null;
    let medicineUpdated = false;

    // 2. If a medicine was selected during onboarding, link prescription and auto-categorize medicine
    if (medicineId) {
      const med = await db.medicine.findUnique({ where: { id: medicineId } });

      if (med) {
        // DYNAMIC LEARNING: Tag this medicine with the customer's condition & mark as chronic
        if (primaryCondition && primaryCondition !== 'General') {
          await db.medicine.update({
            where: { id: medicineId },
            data: {
              category: primaryCondition,
              isChronicMed: true,
            },
          });
          medicineUpdated = true;
        }

        // Calculate refill dates
        const purchaseDateObj = lastPurchaseDate ? new Date(lastPurchaseDate) : new Date();
        const refillCalc = calculateRefill({
          lastPurchaseDate: purchaseDateObj,
          lastPurchaseQty: Number(lastPurchaseQty) || 30,
          dailyDosage: Number(dailyDosage) || 1,
          bufferDays: Number(bufferDays) || 3,
        });

        // Create or update prescription
        prescription = await db.prescription.create({
          data: {
            customerId: customer.id,
            medicineId,
            dailyDosage: Number(dailyDosage) || 1,
            lastPurchaseDate: purchaseDateObj,
            lastPurchaseQty: Number(lastPurchaseQty) || 30,
            nextRefillDate: refillCalc.nextRefillDate,
            bufferDays: Number(bufferDays) || 3,
            doctorName: doctorName || null,
            customPackaging: customPackaging || (primaryCondition === 'Infant Milk' ? '400g Tin' : `${med.unitsPerPack} tabs/strip`),
            unitType: primaryCondition === 'Infant Milk' ? 'grams' : unitType,
            isActive: true,
          },
          include: {
            medicine: true,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      customer,
      prescription,
      medicineUpdated,
      message: `Patient ${customer.name} onboarded successfully!`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Error onboarding patient' }, { status: 500 });
  }
}
