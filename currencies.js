/**
 * Curated fiat currency list. The Frankfurter API supports all of these.
 * Flags are presentational only and do not imply a currency's issuing country.
 */
export const CURRENCIES = [
  { code: 'USD', zh: '美元', en: 'US Dollar', symbol: '$', flag: '🇺🇸', popular: true },
  { code: 'CNY', zh: '人民币', en: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', popular: true },
  { code: 'EUR', zh: '欧元', en: 'Euro', symbol: '€', flag: '🇪🇺', popular: true },
  { code: 'JPY', zh: '日元', en: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', popular: true },
  { code: 'GBP', zh: '英镑', en: 'British Pound', symbol: '£', flag: '🇬🇧', popular: true },
  { code: 'HKD', zh: '港币', en: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰', popular: true },
  { code: 'TWD', zh: '新台币', en: 'New Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼', popular: true },
  { code: 'KRW', zh: '韩元', en: 'South Korean Won', symbol: '₩', flag: '🇰🇷', popular: true },
  { code: 'SGD', zh: '新加坡元', en: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', popular: true },
  { code: 'AUD', zh: '澳元', en: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', popular: true },
  { code: 'CAD', zh: '加元', en: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', popular: true },
  { code: 'CHF', zh: '瑞士法郎', en: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭', popular: true },
  { code: 'NZD', zh: '新西兰元', en: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'THB', zh: '泰铢', en: 'Thai Baht', symbol: '฿', flag: '🇹🇭', popular: true },
  { code: 'MYR', zh: '马来西亚林吉特', en: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'PHP', zh: '菲律宾比索', en: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'VND', zh: '越南盾', en: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'IDR', zh: '印尼盾', en: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'INR', zh: '印度卢比', en: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'AED', zh: '阿联酋迪拉姆', en: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', zh: '沙特里亚尔', en: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
  { code: 'TRY', zh: '土耳其里拉', en: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'RUB', zh: '俄罗斯卢布', en: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'BRL', zh: '巴西雷亚尔', en: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', zh: '墨西哥比索', en: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'ZAR', zh: '南非兰特', en: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'SEK', zh: '瑞典克朗', en: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', zh: '挪威克朗', en: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', zh: '丹麦克朗', en: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'PLN', zh: '波兰兹罗提', en: 'Polish Złoty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', zh: '捷克克朗', en: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'HUF', zh: '匈牙利福林', en: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'RON', zh: '罗马尼亚列伊', en: 'Romanian Leu', symbol: 'lei', flag: '🇷🇴' },
  { code: 'BGN', zh: '保加利亚列弗', en: 'Bulgarian Lev', symbol: 'лв', flag: '🇧🇬' },
  { code: 'RSD', zh: '塞尔维亚第纳尔', en: 'Serbian Dinar', symbol: 'дин', flag: '🇷🇸' },
  { code: 'ILS', zh: '以色列新谢克尔', en: 'Israeli New Shekel', symbol: '₪', flag: '🇮🇱' },
  { code: 'EGP', zh: '埃及镑', en: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  { code: 'PKR', zh: '巴基斯坦卢比', en: 'Pakistani Rupee', symbol: '₨', flag: '🇵🇰' },
  { code: 'BDT', zh: '孟加拉塔卡', en: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩' },
  { code: 'LKR', zh: '斯里兰卡卢比', en: 'Sri Lankan Rupee', symbol: 'Rs', flag: '🇱🇰' },
  { code: 'NPR', zh: '尼泊尔卢比', en: 'Nepalese Rupee', symbol: 'रू', flag: '🇳🇵' },
  { code: 'MOP', zh: '澳门元', en: 'Macanese Pataca', symbol: 'MOP$', flag: '🇲🇴' },
  { code: 'KWD', zh: '科威特第纳尔', en: 'Kuwaiti Dinar', symbol: 'د.ك', flag: '🇰🇼' },
  { code: 'QAR', zh: '卡塔尔里亚尔', en: 'Qatari Riyal', symbol: 'ر.ق', flag: '🇶🇦' },
  { code: 'OMR', zh: '阿曼里亚尔', en: 'Omani Rial', symbol: 'ر.ع.', flag: '🇴🇲' },
  { code: 'BHD', zh: '巴林第纳尔', en: 'Bahraini Dinar', symbol: '.د.ب', flag: '🇧🇭' },
  { code: 'JOD', zh: '约旦第纳尔', en: 'Jordanian Dinar', symbol: 'د.ا', flag: '🇯🇴' },
  { code: 'ISK', zh: '冰岛克朗', en: 'Icelandic Króna', symbol: 'kr', flag: '🇮🇸' },
  { code: 'CLP', zh: '智利比索', en: 'Chilean Peso', symbol: 'CLP$', flag: '🇨🇱' },
  { code: 'COP', zh: '哥伦比亚比索', en: 'Colombian Peso', symbol: 'COL$', flag: '🇨🇴' },
  { code: 'ARS', zh: '阿根廷比索', en: 'Argentine Peso', symbol: 'AR$', flag: '🇦🇷' },
  { code: 'PEN', zh: '秘鲁索尔', en: 'Peruvian Sol', symbol: 'S/', flag: '🇵🇪' },
  { code: 'NGN', zh: '尼日利亚奈拉', en: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { code: 'KES', zh: '肯尼亚先令', en: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'MAD', zh: '摩洛哥迪拉姆', en: 'Moroccan Dirham', symbol: 'د.م.', flag: '🇲🇦' },
  { code: 'TND', zh: '突尼斯第纳尔', en: 'Tunisian Dinar', symbol: 'د.ت', flag: '🇹🇳' },
  { code: 'DZD', zh: '阿尔及利亚第纳尔', en: 'Algerian Dinar', symbol: 'دج', flag: '🇩🇿' },
  { code: 'UAH', zh: '乌克兰格里夫纳', en: 'Ukrainian Hryvnia', symbol: '₴', flag: '🇺🇦' },
  { code: 'KZT', zh: '哈萨克斯坦坚戈', en: 'Kazakhstani Tenge', symbol: '₸', flag: '🇰🇿' },
  { code: 'GEL', zh: '格鲁吉亚拉里', en: 'Georgian Lari', symbol: '₾', flag: '🇬🇪' },
  { code: 'XOF', zh: '西非法郎', en: 'West African CFA Franc', symbol: 'CFA', flag: '🌍' },
  { code: 'XAF', zh: '中非法郎', en: 'Central African CFA Franc', symbol: 'FCFA', flag: '🌍' },
];

export const CURRENCY_MAP = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

export const QUICK_PAIRS = [
  ['USD', 'CNY'],
  ['EUR', 'CNY'],
  ['JPY', 'CNY'],
  ['HKD', 'CNY'],
];

export function findCurrency(code) {
  return CURRENCY_MAP.get(code) ?? {
    code,
    zh: code,
    en: code,
    symbol: code,
    flag: '🌐',
    popular: false,
  };
}

export function searchCurrencies(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return CURRENCIES;
  return CURRENCIES.filter((currency) => (
    currency.code.toLowerCase().includes(normalized)
    || currency.zh.includes(normalized)
    || currency.en.toLowerCase().includes(normalized)
  ));
}
