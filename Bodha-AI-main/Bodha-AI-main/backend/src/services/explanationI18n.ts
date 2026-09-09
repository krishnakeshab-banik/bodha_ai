/**
 * Language-aware pricing explanations.
 *
 * The pricing engine stays English (and unit-testable). This module rebuilds
 * the seller-facing paragraph in the selected UI language from the same
 * numbers, so Hindi/Tamil reports are generated — not machine-translated after
 * the fact in a brittle way.
 */

import type { IndexLevel, PlatformRecommendation, UiLanguage } from '../types/index.js';

const inr = (value: number): string => '₹' + Math.round(value).toLocaleString('en-IN');

const LEVEL: Record<UiLanguage, Record<IndexLevel, string>> = {
  en: { Low: 'low', Medium: 'medium', High: 'high' },
  hi: { Low: 'कम', Medium: 'मध्यम', High: 'अधिक' },
  ta: { Low: 'குறைந்த', Medium: 'நடுத்தர', High: 'அதிக' },
};

function sampleNote(language: UiLanguage, listingCount: number): string {
  if (listingCount <= 0) return '';
  if (language === 'hi') return ' (' + listingCount + ' लाइव लिस्टिंग की माध्यिका)';
  if (language === 'ta') return ' (' + listingCount + ' நேரடி பட்டியல்களின் இடைநிலை)';
  return ' (median of ' + listingCount + ' live listings)';
}

function bulkNote(language: UiLanguage, isBulk: boolean): string {
  if (!isBulk) return '';
  if (language === 'hi') {
    return ' याद रखें कि Alibaba कीमतें मात्रा पर प्रति यूनिट हैं, इसलिए यह थोक ऑर्डर मानता है।';
  }
  if (language === 'ta') {
    return ' Alibaba விலைகள் அளவின் அடிப்படையில் ஒரு அலகுக்கு என்பதை நினைவில் கொள்க; இது மொத்த ஆர்டரைக் கருதுகிறது.';
  }
  return ' Remember that Alibaba prices are quoted per unit at volume, so this assumes a bulk order.';
}

export function localizeExplanation(
  platform: PlatformRecommendation,
  language: UiLanguage,
  currentPrice: number,
): string {
  if (language === 'en') return platform.explanation;

  const name = platform.name;
  const market = inr(platform.marketPrice);
  const floor = inr(platform.breakEvenPrice);
  const rec = inr(platform.recommendedPrice);
  const listed = inr(currentPrice);
  const profit = inr(platform.estimatedProfit);
  const demand = LEVEL[language][platform.demand];
  const competition = LEVEL[language][platform.competition];
  const sample = sampleNote(language, platform.listingCount);
  const bulk = bulkNote(language, platform.isBulkMarketplace);

  const profitAtList =
    language === 'hi'
      ? 'आपकी ' +
        listed +
        ' कीमत पर, कमीशन, शिपिंग और निर्माण लागत के बाद अनुमानित लाभ लगभग ' +
        profit +
        ' प्रति यूनिट है। '
      : 'உங்கள் ' +
        listed +
        ' விலையில், கமிஷன், ஷிப்பிங் மற்றும் உற்பத்திச் செலவுக்குப் பிறகு மதிப்பிடப்பட்ட லாபம் ஒரு அலகுக்கு சுமார் ' +
        profit +
        '. ';

  if (platform.unavailable) {
    if (language === 'hi') {
      return (
        name +
        ' के लिए लाइव बाज़ार डेटा अभी उपलब्ध नहीं है, इसलिए माध्यिका और सीमा नहीं दिखाई जा सकती। ' +
        (platform.profitAvailable === false
          ? 'लाभ तब तक नहीं निकाला जा सकता जब तक निर्माण लागत और बिक्री कीमत दोनों उपलब्ध न हों।'
          : profitAtList.trim())
      );
    }
    return (
      name +
      'க்கான நேரடி சந்தைத் தரவு தற்காலிகமாக இல்லை, எனவே இடைநிலை மற்றும் வரம்பைக் காட்ட முடியாது. ' +
      (platform.profitAvailable === false
        ? 'உற்பத்திச் செலவும் விற்பனை விலையும் இல்லாமல் லாபத்தைக் கணக்கிட முடியாது.'
        : profitAtList.trim())
    );
  }

  if (platform.lossRiskAvoided) {
    if (language === 'hi') {
      return (
        profitAtList +
        name +
        ' पर तुलनात्मक उत्पाद लगभग ' +
        market +
        sample +
        ' पर बिकते हैं, जो कमीशन और शिपिंग के बाद आपके ब्रेक-ईवन ' +
        floor +
        ' से नीचे है। Bodha AI ने घाटे वाली कीमत सुझाने से मना किया है और सुझाव को ' +
        rec +
        ' पर रोका है। यहाँ बिक्री धीमी हो सकती है, या इस मार्केटप्लेस पर जाने से पहले निर्माण लागत घटाएँ।'
      );
    }
    return (
      profitAtList +
      name +
      ' இல் ஒப்பீட்டு பொருட்கள் சுமார் ' +
      market +
      sample +
      'க்கு விற்கப்படுகின்றன, இது கமிஷன் மற்றும் ஷிப்பிங்கிற்குப் பிறகு உங்கள் இலாப-இழப்பு புள்ளி ' +
      floor +
      'க்குக் கீழ். Bodha AI நட்ட விலையைப் பரிந்துரைக்க மறுத்து பரிந்துரையை ' +
      rec +
      ' இல் நிறுத்தியுள்ளது. இங்கே விற்பனை மெதுவாக இருக்கலாம், அல்லது இந்தத் தளத்திற்குச் செல்வதற்கு முன் உற்பத்திச் செலவைக் குறையுங்கள்.'
    );
  }

  if (platform.priceAction === 'increase') {
    if (language === 'hi') {
      return (
        profitAtList +
        name +
        ' पर समान उत्पाद लगभग ' +
        market +
        sample +
        ' पर बिकते हैं, जबकि आप ' +
        listed +
        ' पर लिस्टेड हैं। ' +
        demand +
        ' माँग और ' +
        competition +
        ' प्रतिस्पर्धा के साथ कीमत ' +
        rec +
        ' तक बढ़ाने से आप ऊँची कीमत वाले प्रतिस्पर्धियों के साथ रहते हैं, और शुद्ध लाभ लगभग ' +
        profit +
        ' प्रति यूनिट हो जाता है।' +
        bulk
      );
    }
    return (
      profitAtList +
      name +
      ' இல் இதே போன்ற பொருட்கள் சுமார் ' +
      market +
      sample +
      'க்கு விற்கப்படுகின்றன, ஆனால் நீங்கள் ' +
      listed +
      ' இல் பட்டியலிட்டுள்ளீர்கள். ' +
      demand +
      ' தேவை மற்றும் ' +
      competition +
      ' போட்டியுடன் விலையை ' +
      rec +
      'க்கு உயர்த்தினால் ஏற்கனவே உயர் விலையில் உள்ள போட்டியாளர்களுடன் இணைவீர்கள், நிகர லாபம் ஒரு அலகுக்கு சுமார் ' +
      profit +
      ' ஆகும்.' +
      bulk
    );
  }

  if (platform.priceAction === 'decrease') {
    if (language === 'hi') {
      return (
        profitAtList +
        'आप ' +
        listed +
        ' पर लिस्टेड हैं, जबकि ' +
        name +
        ' पर तुलनात्मक उत्पाद लगभग ' +
        market +
        sample +
        ' पर बिकते हैं। ' +
        rec +
        ' तक आने से आप ' +
        competition +
        ' प्रतिस्पर्धा के सामने प्रतिस्पर्धी रहते हैं, फिर भी ब्रेक-ईवन ' +
        floor +
        ' से ऊपर — लगभग ' +
        profit +
        ' प्रति यूनिट बचता है।' +
        bulk
      );
    }
    return (
      profitAtList +
      'நீங்கள் ' +
      listed +
      ' இல் பட்டியலிட்டுள்ளீர்கள், ஆனால் ' +
      name +
      ' இல் ஒப்பீட்டு பொருட்கள் சுமார் ' +
      market +
      sample +
      'க்கு விற்கப்படுகின்றன. ' +
      rec +
      'க்கு இறங்கினால் ' +
      competition +
      ' போட்டிக்கு எதிராக போட்டியிடலாம், இன்னும் இலாப-இழப்பு புள்ளி ' +
      floor +
      'க்கு மேல் — ஒரு அலகுக்கு சுமார் ' +
      profit +
      ' வைத்திருப்பீர்கள்.' +
      bulk
    );
  }

  if (language === 'hi') {
    return (
      profitAtList +
      'आपकी ' +
      listed +
      ' कीमत ' +
      name +
      ' की ' +
      market +
      sample +
      ' चालू दर के सामने पहले से ठीक है। ' +
      demand +
      ' माँग और ' +
      competition +
      ' प्रतिस्पर्धा में री-प्राइस की ज़रूरत नहीं; आप लगभग ' +
      profit +
      ' प्रति यूनिट कमा रहे हैं और ब्रेक-ईवन ' +
      floor +
      ' से ऊपर हैं।' +
      bulk
    );
  }

  return (
    profitAtList +
    'உங்கள் ' +
    listed +
    ' விலை ' +
    name +
    ' இல் உள்ள ' +
    market +
    sample +
    ' நடைமுறை விலைக்கு எதிராக ஏற்கனவே நல்ல நிலையில் உள்ளது. ' +
    demand +
    ' தேவை மற்றும் ' +
    competition +
    ' போட்டியில் மறுவிலை தேவையில்லை; ஒரு அலகுக்கு சுமார் ' +
    profit +
    ' சம்பாதிக்கிறீர்கள், இலாப-இழப்பு புள்ளி ' +
    floor +
    'க்கு மேல் உள்ளீர்கள்.' +
    bulk
  );
}

export function localizePlatformExplanations(
  platforms: PlatformRecommendation[],
  language: UiLanguage,
  currentPrice: number,
): PlatformRecommendation[] {
  if (language === 'en') return platforms;
  return platforms.map((platform) => ({
    ...platform,
    explanation: localizeExplanation(platform, language, currentPrice),
  }));
}
