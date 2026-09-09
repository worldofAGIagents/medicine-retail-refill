export interface TemplateVariables {
  name?: string;
  medicine?: string;
  days?: string | number;
  date?: string;
  pharmacy?: string;
  phone?: string;
  address?: string;
  amount?: string | number;
  upiLink?: string;
  upiId?: string;
  locality?: string;
}

export type TemplateKey =
  | 'hindiTemplate'
  | 'englishTemplate'
  | 'infantMilkTemplate'
  | 'englishInfantMilkTemplate'
  | 'overdueTemplate'
  | 'englishOverdueTemplate'
  | 'outForDeliveryTemplate'
  | 'englishOutForDeliveryTemplate';

export type TemplateCategoryType = 'chronic' | 'infantMilk' | 'overdue' | 'outForDelivery';

export interface TemplateDefinition {
  key: TemplateKey;
  language: 'hindi' | 'english';
  type: TemplateCategoryType;
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
    'नमस्ते {{name}} जी, आपकी नियमित दवाई {{medicine}} {{days}} में समाप्त होने वाली है। क्या हम आपके गाँव ({{address}}) में आज फ्री होम डिलीवरी भिजवा दें? कृपया हाँ या YES लिखकर रिप्लाई करें।\n\n- मनोज मेडिकल हॉल (Manoj Medical Hall), सरफुद्दीनपुर, गोपालपुर (मुज़फ़्फ़रपुर), फोन: {{phone}}',
  englishTemplate:
    'Dear {{name}}, your regular chronic medicine supply of {{medicine}} will finish in {{days}}. Free village doorstep delivery available from Manoj Medical Hall, Sarfuddinpur. Reply YES to confirm delivery.\n\n- Manoj Medical Hall, Ph: {{phone}}',
  infantMilkTemplate:
    'नमस्ते {{name}} जी, आपके बेबी का {{medicine}} लगभग समाप्त होने वाला है (शेष: {{days}})। बच्चे के पोषण में कोई रुकावट न आए, इसके लिए क्या हम नया टिन आज ही आपके गाँव पहुंचा दें? कन्फर्म करने के लिए YES भेजें।\n\n- मनोज मेडिकल हॉल (सरफुद्दीनपुर)',
  englishInfantMilkTemplate:
    "Dear {{name}}, your baby's {{medicine}} is running low (approx {{days}} remaining). To ensure uninterrupted child nutrition, shall we deliver a fresh tin to your village today? Reply YES to confirm.\n\n- Manoj Medical Hall (Sarfuddinpur), Ph: {{phone}}",
  overdueTemplate:
    '⚠️ अति आवश्यक: नमस्ते {{name}} जी, आपकी नियमित दवाई {{medicine}} समाप्त हो चुकी है! स्वास्थ्य सुरक्षा के लिए खुराक न छोड़ें। तुरंत गाँव में डिलीवरी पाने के लिए YES भेजें या कॉल करें।\n\n- मनोज मेडिकल हॉल, सरफुद्दीनपुर, फोन: {{phone}}',
  englishOverdueTemplate:
    '⚠️ URGENT: Dear {{name}}, your regular medicine {{medicine}} is completely finished! Please do not skip your prescribed dose. Reply YES or call now for immediate doorstep village delivery.\n\n- Manoj Medical Hall, Sarfuddinpur, Ph: {{phone}}',
  outForDeliveryTemplate:
    'नमस्ते {{name}} जी, आपकी दवाई मनोज मेडिकल हॉल (सरफुद्दीनपुर) से आपके गाँव के पते के लिए निकल चुकी है। कृपया डिलीवरी बॉय को कैश या UPI द्वारा भुगतान करें।\n\n- मनोज मेडिकल हॉल, फोन: {{phone}}',
  englishOutForDeliveryTemplate:
    'Dear {{name}}, your medicine order has departed from Manoj Medical Hall for delivery to your village address. Please pay the delivery rider via Cash or UPI.\n\n- Manoj Medical Hall, Ph: {{phone}}',
};

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  // 1. Hindi Templates
  {
    key: 'hindiTemplate',
    language: 'hindi',
    type: 'chronic',
    label: 'नियमित क्रॉनिक रिफिल अलर्ट (Hindi)',
    shortLabel: 'क्रॉनिक रिफिल',
    category: 'Chronic Refill',
    badge: 'Proactive Alert',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'मरीज़ की नियमित दवाई समाप्त होने से 2-3 दिन पूर्व भेजा जाने वाला अलर्ट (हिंदी में)।',
    sampleVars: {
      name: 'रमेश कुमार',
      medicine: 'Glycomet-GP 1mg (Strip of 15)',
      days: '3 दिन',
      date: '08 सितम्बर',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'गाँव: गोपालपुर, वार्ड 4 (निकट शिव मंदिर)',
    },
  },
  {
    key: 'infantMilkTemplate',
    language: 'hindi',
    type: 'infantMilk',
    label: 'शिशु आहार / मिल्क फॉर्मूला अलर्ट (Hindi)',
    shortLabel: 'शिशु आहार (Infant Milk)',
    category: 'Baby Nutrition',
    badge: 'Infant Nutrition',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'शिशु फॉर्मूला टिन (Nan Pro / Similac) कम होने पर परिजनों को भेजा जाने वाला विशेष अलर्ट।',
    sampleVars: {
      name: 'पूजा कुमारी',
      medicine: 'Nan Pro Stage 1 (400g Tin)',
      days: '2 दिन (लगभग 3 स्कूप)',
      date: '07 सितम्बर',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'गाँव: सरफुद्दीनपुर (निकट मिडिल स्कूल)',
    },
  },
  {
    key: 'overdueTemplate',
    language: 'hindi',
    type: 'overdue',
    label: 'अति आवश्यक ओवरड्यू अलर्ट (Hindi)',
    shortLabel: 'ओवरड्यू अलर्ट (Urgent)',
    category: 'Urgent Alert',
    badge: 'High Priority',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    description: 'जब मरीज़ की दवाई पूरी तरह समाप्त हो चुकी हो (0 दिन शेष), तुरंत खुराक जारी रखने हेतु।',
    sampleVars: {
      name: 'सुरेश गुप्ता',
      medicine: 'Thyronorm 50mcg (Bottle of 120)',
      days: 'समाप्त हो चुकी है',
      date: 'आज',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'गाँव: बोचहाँ, मेन चौक',
    },
  },
  {
    key: 'outForDeliveryTemplate',
    language: 'hindi',
    type: 'outForDelivery',
    label: 'ऑर्डर डिलीवरी के लिए रवाना (Hindi)',
    shortLabel: 'डिलीवरी रवाना',
    category: 'Order Dispatch',
    badge: 'Delivery Tracking',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'जब दवाई पैक करके गाँव के पते के लिए राइडर को सौंपी जाती है।',
    sampleVars: {
      name: 'विक्रम महतो',
      medicine: 'Telvas 40mg & Glycomet GP 1mg',
      days: 'आज रवाना',
      date: 'आज',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'गाँव: गायघाट (निकट पुलिया)',
    },
  },

  // 2. English Templates
  {
    key: 'englishTemplate',
    language: 'english',
    type: 'chronic',
    label: 'Chronic Refill Reminder (English)',
    shortLabel: 'Chronic Refill',
    category: 'Chronic Refill',
    badge: 'Proactive Alert',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Sent 2-3 days before regular chronic medicine runs out in English.',
    sampleVars: {
      name: 'Ramesh Kumar',
      medicine: 'Telma 40mg (Strip of 30)',
      days: '3 days',
      date: '08 Sep',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'Village: Gopalpur, Ward 4 (Near Shiv Mandir)',
    },
  },
  {
    key: 'englishInfantMilkTemplate',
    language: 'english',
    type: 'infantMilk',
    label: 'Infant Milk Formula Replenishment (English)',
    shortLabel: 'Infant Formula',
    category: 'Baby Nutrition',
    badge: 'Infant Nutrition',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Special care reminder for parents whose infant formula tin (Nan Pro / Similac) is low.',
    sampleVars: {
      name: 'Pooja Kumari',
      medicine: 'Nan Pro Stage 1 (400g Tin)',
      days: '2 days (approx 3 scoops)',
      date: '07 Sep',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'Village: Sarfuddinpur (Near Middle School)',
    },
  },
  {
    key: 'englishOverdueTemplate',
    language: 'english',
    type: 'overdue',
    label: 'Urgent Overdue Alert (English)',
    shortLabel: 'Overdue Alert',
    category: 'Urgent Alert',
    badge: 'High Priority',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    description: 'Sent when patient medicine has completely run out (0 or negative days remaining).',
    sampleVars: {
      name: 'Suresh Gupta',
      medicine: 'Thyronorm 50mcg (Bottle of 120)',
      days: 'Finished / 0 days',
      date: 'Today',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'Village: Bochahan Main Chowk',
    },
  },
  {
    key: 'englishOutForDeliveryTemplate',
    language: 'english',
    type: 'outForDelivery',
    label: 'Order Out for Delivery Notification (English)',
    shortLabel: 'Out for Delivery',
    category: 'Order Dispatch',
    badge: 'Delivery Tracking',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Sent to patient when their order has been packed and handed to delivery rider.',
    sampleVars: {
      name: 'Vikram Mahto',
      medicine: 'Telvas 40mg & Glycomet GP 1mg',
      days: 'Dispatched Today',
      date: 'Today',
      pharmacy: 'Manoj Medical Hall',
      phone: '9431422744',
      address: 'Village: Gaighat (Near Bridge)',
    },
  },
];

export const TEMPLATE_TAGS = [
  { tag: '{{name}}', label: 'Patient Name', example: 'Ramesh Sharma' },
  { tag: '{{medicine}}', label: 'Medicine / Item', example: 'Telvas 40mg' },
  { tag: '{{days}}', label: 'Days Remaining', example: '3 दिन / 3 days' },
  { tag: '{{date}}', label: 'Refill Date', example: '08 Sep' },
  { tag: '{{pharmacy}}', label: 'Pharmacy Name', example: 'Manoj Medical Hall' },
  { tag: '{{phone}}', label: 'Pharmacy Phone', example: '9431422744' },
  { tag: '{{address}}', label: 'Village / Landmark', example: 'Gopalpur, Ward 4' },
  { tag: '{{amount}}', label: 'Amount Payable', example: '₹450' },
  { tag: '{{upiLink}}', label: 'UPI Payment Link', example: 'upi://pay?pa=manojmedical@okhdfcbank&...' },
];

export function renderTemplate(template: string, vars: TemplateVariables): string {
  if (!template) return '';

  let rendered = template;

  const replacements: Record<string, string> = {
    '{{name}}': vars.name || 'Valued Customer',
    '{{medicine}}': vars.medicine || 'Medicine',
    '{{days}}': vars.days !== undefined ? String(vars.days) : '2-3 days',
    '{{date}}': vars.date || '',
    '{{pharmacy}}': vars.pharmacy || 'Manoj Medical Hall',
    '{{phone}}': vars.phone || '',
    '{{address}}': vars.address || '',
    '{{locality}}': vars.locality || vars.address || '',
    '{{amount}}': vars.amount !== undefined ? String(vars.amount) : '',
    '{{upiLink}}': vars.upiLink || '',
    '{{upiId}}': vars.upiId || '',
  };

  for (const [placeholder, val] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(placeholder, val);
  }

  return rendered;
}

