export interface TemplateVariables {
  name?: string;
  medicine?: string;
  days?: string | number;
  date?: string;
  pharmacy?: string;
  phone?: string;
  address?: string;
}

export type TemplateKey =
  | 'hindiTemplate'
  | 'englishTemplate'
  | 'infantMilkTemplate'
  | 'overdueTemplate'
  | 'outForDeliveryTemplate';

export interface TemplateDefinition {
  key: TemplateKey;
  label: string;
  shortLabel: string;
  category: string;
  badge: string;
  badgeColor: string;
  description: string;
  sampleVars: TemplateVariables;
}

export const DEFAULT_TEMPLATES: Record<string, string> = {
  preferredLanguage: 'hindi',
  hindiTemplate:
    'नमस्ते {{name}} जी, आपकी नियमित दवाई {{medicine}} {{days}} में समाप्त होने वाली है। क्या हम आपके घर पर फ्री होम डिलीवरी भेज दें? रिप्लाई में YES लिखकर भेजें।\n\n- {{pharmacy}}, फोन: {{phone}}',
  englishTemplate:
    'Dear {{name}}, your chronic medicine supply of {{medicine}} will finish in {{days}}. To get free doorstep delivery, reply YES to confirm.\n\n- {{pharmacy}}, Ph: {{phone}}',
  infantMilkTemplate:
    'नमस्ते {{name}} जी, आपके बेबी का {{medicine}} लगभग समाप्त होने वाला है (शेष: {{days}})। बच्चे के पोषण में कोई रुकावट न आए, इसके लिए क्या हम नया टिन आज ही डिलीवर कर दें? कन्फर्म करने के लिए YES भेजें।\n\n- {{pharmacy}}',
  overdueTemplate:
    '⚠️ अति आवश्यक: नमस्ते {{name}} जी, आपकी नियमित दवाई {{medicine}} समाप्त हो चुकी है! स्वास्थ्य सुरक्षा के लिए खुराक न छोड़ें। तुरंत डिलीवरी पाने के लिए YES भेजें या कॉल करें।\n\n- {{pharmacy}}, फोन: {{phone}}',
  outForDeliveryTemplate:
    'नमस्ते {{name}} जी, आपका दवाई ऑर्डर डिस्पैच हो गया है और डिलीवरी राइडर जल्द ही आपके पते पर पहुंचेगा।\n\n- {{pharmacy}}, फोन: {{phone}}',
};

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: 'hindiTemplate',
    label: 'Chronic Refill Reminder (Hindi)',
    shortLabel: 'Hindi Chronic',
    category: 'Chronic Refill',
    badge: 'Proactive Alert',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Sent 2-3 days before chronic patient runs out of regular medication in Hindi.',
    sampleVars: {
      name: 'रमेश कुमार',
      medicine: 'Glycomet-GP 1mg (Strip of 15)',
      days: '3 दिन',
      date: '08 सितम्बर',
      pharmacy: 'MedRefill Chemist',
      phone: '+91 98765 43210',
      address: 'फ्लैट 402, शांति हाइट्स, सेक्टर 62',
    },
  },
  {
    key: 'englishTemplate',
    label: 'Chronic Refill Reminder (English)',
    shortLabel: 'English Chronic',
    category: 'Chronic Refill',
    badge: 'Proactive Alert',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Sent 2-3 days before chronic patient runs out of regular medication in English.',
    sampleVars: {
      name: 'Ramesh Kumar',
      medicine: 'Telma 40mg (Strip of 30)',
      days: '3 days',
      date: '08 Sep',
      pharmacy: 'MedRefill Chemist',
      phone: '+91 98765 43210',
      address: 'Flat 402, Shanti Heights, Sector 62',
    },
  },
  {
    key: 'infantMilkTemplate',
    label: 'Infant Milk Formula Replenishment',
    shortLabel: 'Infant Milk',
    category: 'Baby Nutrition',
    badge: 'Infant Nutrition',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Special care reminder for parents whose infant formula tin (Nan Pro / Similac) is low.',
    sampleVars: {
      name: 'Pooja Sharma',
      medicine: 'Nan Pro Stage 1 (400g Tin)',
      days: '2 दिन (लगभग 3 स्कूप)',
      date: '07 सितम्बर',
      pharmacy: 'MedRefill Chemist',
      phone: '+91 98765 43210',
      address: 'House 12, Green Park Avenue',
    },
  },
  {
    key: 'overdueTemplate',
    label: 'Urgent Overdue Alert (Stock Finished)',
    shortLabel: 'Overdue Alert',
    category: 'Urgent Alert',
    badge: 'High Priority',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    description: 'Sent when patient medicine has completely run out (0 or negative days remaining).',
    sampleVars: {
      name: 'सुरेश गुप्ता',
      medicine: 'Thyronorm 50mcg (Bottle of 120)',
      days: 'समाप्त हो चुकी है',
      date: 'आज',
      pharmacy: 'MedRefill Chemist',
      phone: '+91 98765 43210',
      address: 'B-21, Alpha Commercial Complex',
    },
  },
  {
    key: 'outForDeliveryTemplate',
    label: 'Order Out for Delivery Notification',
    shortLabel: 'Out for Delivery',
    category: 'Order Dispatch',
    badge: 'Delivery Tracking',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Sent to patient when their order has been packed and handed to delivery rider.',
    sampleVars: {
      name: 'Vikram Mehta',
      medicine: 'Amlong 5mg & Janumet 50/500mg',
      days: 'Dispatched',
      date: 'Today',
      pharmacy: 'MedRefill Chemist',
      phone: '+91 98765 43210',
      address: 'Tower 4, Flat 1102, Express Park',
    },
  },
];

export const TEMPLATE_TAGS = [
  { tag: '{{name}}', label: 'Patient Name', example: 'Ramesh Sharma' },
  { tag: '{{medicine}}', label: 'Medicine / Item', example: 'Glycomet GP 1mg' },
  { tag: '{{days}}', label: 'Days Remaining', example: '3 दिन / 3 days' },
  { tag: '{{date}}', label: 'Refill Date', example: '08 Sep' },
  { tag: '{{pharmacy}}', label: 'Pharmacy Name', example: 'MedRefill Chemist' },
  { tag: '{{phone}}', label: 'Pharmacy Phone', example: '+91 98765 43210' },
  { tag: '{{address}}', label: 'Customer Address', example: 'Flat 402, Sector 62' },
];

export function renderTemplate(template: string, vars: TemplateVariables): string {
  if (!template) return '';

  let rendered = template;

  const replacements: Record<string, string> = {
    '{{name}}': vars.name || 'Valued Customer',
    '{{medicine}}': vars.medicine || 'Medicine',
    '{{days}}': vars.days !== undefined ? String(vars.days) : '2-3 days',
    '{{date}}': vars.date || '',
    '{{pharmacy}}': vars.pharmacy || 'MedRefill Chemist',
    '{{phone}}': vars.phone || '',
    '{{address}}': vars.address || '',
  };

  for (const [placeholder, val] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(placeholder, val);
  }

  return rendered;
}

