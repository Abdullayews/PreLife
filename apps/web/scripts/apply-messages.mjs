// Merges the PreLife UI namespaces into messages/<locale>.json.
// - Existing keys that are NOT managed below (e.g. your original `welcome`
//   namespace) are preserved untouched.
// - Managed namespaces are replaced wholesale, so re-running this script is
//   always safe (idempotent) and removes keys dropped in newer UI versions.
// Usage: node scripts/apply-messages.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");

const UI_NAMESPACES = {
  en: {
    nav: {
      home: "Home",
      gym: "Gym",
      diet: "Diet",
      meditation: "Meditation",
      library: "Library",
      language: "Language",
    },
    footer: {
      tagline: "A multi-domain platform for personal development",
      rights: "\u00A9 {year} PreLife. All rights reserved.",
    },
    landing: {
      modulesTitle: "One platform, four life domains",
      modulesSubtitle: "Each module has its own space. Start with the one you need.",
      reasonsTitle: "Why PreLife?",
      reason1Title: "Everything in one place",
      reason1Text: "Fitness, nutrition, meditation and reading. One account, one interface, one subscription.",
      reason2Title: "Pay only for what you use",
      reason2Text: "A flexible, module-selective subscription: activate only the areas you actually need.",
      reason3Title: "An AI assistant in every module",
      reason3Text: "A personal assistant that learns from your data and advises you individually.",
    },
    modules: {
      gym: "Training plans, exercise tutorials and a gym directory",
      diet: "A personal diet plan, recipes and daily suggestions",
      meditation: "Audio sessions and daily practice tracking",
      library: "Curated books and reading recommendations",
    },
    modulePage: {
      comingSoon: "This module is under construction",
      backHome: "Back to home",
    },
    notFound: {
      title: "Page not found",
      description: "The page you are looking for does not exist or has been moved.",
      backHome: "Back to home",
    },
    error: {
      title: "Something went wrong",
      retry: "Try again",
    },
    Metadata: {
      title: "PreLife \u2014 Premium Life",
      description: "Fitness, nutrition, meditation and a library, in one platform.",
    },
  },
  az: {
    nav: {
      home: "Ba\u015f s\u0259hif\u0259",
      gym: "\u0130dman",
      diet: "P\u0259hriz",
      meditation: "Meditasiya",
      library: "Kitabxana",
      language: "Dil",
    },
    footer: {
      tagline: "\u015e\u0259xsi inki\u015faf \u00fc\u00e7\u00fcn \u00e7ox\u015fax\u0259li platforma",
      rights: "\u00A9 {year} PreLife. B\u00fct\u00fcn h\u00fcquqlar qorunur.",
    },
    landing: {
      modulesTitle: "Bir platforma \u2014 h\u0259yat\u0131n d\u00f6rd sah\u0259si",
      modulesSubtitle: "H\u0259r modulun \u00f6z sah\u0259di var. Ehtiyac\u0131n olandan ba\u015fla.",
      reasonsTitle: "Niy\u0259 PreLife?",
      reason1Title: "H\u0259r \u015fey bir yerd\u0259",
      reason1Text: "\u0130dman, qidalanma, meditasiya v\u0259 oxu. Bir hesab, bir interfeys, bir abun\u0259.",
      reason2Title: "Yaln\u0131z istifad\u0259 etdiyin \u00fc\u00e7\u00fcn \u00f6d\u0259",
      reason2Text: "\u018fyil\u0259n, modul-se\u00e7ici abun\u0259: yaln\u0131z h\u0259qiq\u0259t\u0259n ehtiyac\u0131n olan sah\u0259l\u0259ri aktivl\u0259\u015fdir.",
      reason3Title: "H\u0259r modulda AI k\u00f6m\u0259k\u00e7i",
      reason3Text: "M\u0259lumatlar\u0131ndan \u00f6yr\u0259n\u0259n v\u0259 s\u0259n\u0259 f\u0259rdi m\u0259sl\u0259h\u0259tl\u0259r ver\u0259n \u015f\u0259xsi k\u00f6m\u0259k\u00e7i.",
    },
    modules: {
      gym: "T\u0259lim planlar\u0131, m\u0259\u015fq b\u0259l\u0259d\u00e7il\u0259ri v\u0259 idman zal\u0131 kataloqu",
      diet: "\u015e\u0259xsi p\u0259hriz plan\u0131, reseptl\u0259r v\u0259 g\u00fcnd\u0259lik t\u00f6vsiy\u0259l\u0259r",
      meditation: "S\u0259sli seanslar v\u0259 g\u00fcnd\u0259lik praktikan\u0131n izl\u0259nm\u0259si",
      library: "Se\u00e7ilmi\u015f kitablar v\u0259 oxu t\u00f6vsiy\u0259l\u0259ri",
    },
    modulePage: {
      comingSoon: "Bu modul haz\u0131rlan\u0131r",
      backHome: "Ana s\u0259hif\u0259y\u0259 qay\u0131t",
    },
    notFound: {
      title: "S\u0259hif\u0259 tap\u0131lmad\u0131",
      description: "Axtard\u0131\u011f\u0131n\u0131z s\u0259hif\u0259 m\u00f6vcud deyil v\u0259 ya k\u00f6\u00e7\u00fcr\u00fcl\u00fcb.",
      backHome: "Ana s\u0259hif\u0259y\u0259 qay\u0131t",
    },
    error: {
      title: "Bir x\u0259ta ba\u015f verdi",
      retry: "Yenid\u0259n c\u0259hd et",
    },
    Metadata: {
      title: "PreLife \u2014 Premium Life",
      description: "\u0130dman, qidalanma, meditasiya v\u0259 kitabxana \u2014 bir platformada.",
    },
  },
  ru: {
    nav: {
      home: "\u0413\u043b\u0430\u0432\u043d\u0430\u044f",
      gym: "\u0421\u043f\u043e\u0440\u0442\u0437\u0430\u043b",
      diet: "\u041f\u0438\u0442\u0430\u043d\u0438\u0435",
      meditation: "\u041c\u0435\u0434\u0438\u0442\u0430\u0446\u0438\u044f",
      library: "\u0411\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430",
      language: "\u042f\u0437\u044b\u043a",
    },
    footer: {
      tagline: "\u041c\u0443\u043b\u044c\u0442\u0438\u0434\u043e\u043c\u0435\u043d\u043d\u0430\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430 \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u043d\u043e\u0433\u043e \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u044f",
      rights: "\u00A9 {year} PreLife. \u0412\u0441\u0435 \u043f\u0440\u0430\u0432\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043d\u044b.",
    },
    landing: {
      modulesTitle: "\u041e\u0434\u043d\u0430 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430 \u2014 \u0447\u0435\u0442\u044b\u0440\u0435 \u0441\u0444\u0435\u0440\u044b \u0436\u0438\u0437\u043d\u0438",
      modulesSubtitle: "\u0423 \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u043c\u043e\u0434\u0443\u043b\u044f \u0441\u0432\u043e\u0451 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e. \u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u0441 \u0442\u043e\u0433\u043e, \u0447\u0442\u043e \u043d\u0443\u0436\u043d\u043e \u0432\u0430\u043c.",
      reasonsTitle: "\u041f\u043e\u0447\u0435\u043c\u0443 PreLife?",
      reason1Title: "\u0412\u0441\u0451 \u0432 \u043e\u0434\u043d\u043e\u043c \u043c\u0435\u0441\u0442\u0435",
      reason1Text: "\u0424\u0438\u0442\u043d\u0435\u0441, \u043f\u0438\u0442\u0430\u043d\u0438\u0435, \u043c\u0435\u0434\u0438\u0442\u0430\u0446\u0438\u044f \u0438 \u0447\u0442\u0435\u043d\u0438\u0435. \u041e\u0434\u0438\u043d \u0430\u043a\u043a\u0430\u0443\u043d\u0442, \u043e\u0434\u0438\u043d \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441, \u043e\u0434\u043d\u0430 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0430.",
      reason2Title: "\u041f\u043b\u0430\u0442\u0438\u0442\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0437\u0430 \u043d\u0443\u0436\u043d\u043e\u0435",
      reason2Text: "\u0413\u0438\u0431\u043a\u0430\u044f \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043f\u043e \u043c\u043e\u0434\u0443\u043b\u044f\u043c: \u0430\u043a\u0442\u0438\u0432\u0438\u0440\u0443\u0439\u0442\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0442\u0435 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u0430\u043c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u043d\u0443\u0436\u043d\u044b.",
      reason3Title: "\u0418\u0418-\u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a \u0432 \u043a\u0430\u0436\u0434\u043e\u043c \u043c\u043e\u0434\u0443\u043b\u0435",
      reason3Text: "\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u0443\u0447\u0438\u0442\u0441\u044f \u043d\u0430 \u0432\u0430\u0448\u0438\u0445 \u0434\u0430\u043d\u043d\u044b\u0445 \u0438 \u0434\u0430\u0451\u0442 \u0438\u043d\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043b\u044c\u043d\u044b\u0435 \u0441\u043e\u0432\u0435\u0442\u044b.",
    },
    modules: {
      gym: "\u041f\u043b\u0430\u043d\u044b \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a, \u043e\u0431\u0443\u0447\u0430\u044e\u0449\u0438\u0435 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u0438 \u043a\u0430\u0442\u0430\u043b\u043e\u0433 \u0437\u0430\u043b\u043e\u0432",
      diet: "\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u043b\u0430\u043d \u043f\u0438\u0442\u0430\u043d\u0438\u044f, \u0440\u0435\u0446\u0435\u043f\u0442\u044b \u0438 \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438",
      meditation: "\u0410\u0443\u0434\u0438\u043e-\u0441\u0435\u0430\u043d\u0441\u044b \u0438 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u0435 \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u043e\u0439 \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0438",
      library: "\u041f\u043e\u0434\u0431\u043e\u0440\u043a\u0430 \u043a\u043d\u0438\u0433 \u0438 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u0434\u043b\u044f \u0447\u0442\u0435\u043d\u0438\u044f",
    },
    modulePage: {
      comingSoon: "\u042d\u0442\u043e\u0442 \u043c\u043e\u0434\u0443\u043b\u044c \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435",
      backHome: "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e",
    },
    notFound: {
      title: "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430",
      description: "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430, \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0432\u044b \u0438\u0449\u0435\u0442\u0435, \u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u0438\u043b\u0438 \u0431\u044b\u043b\u0430 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0430.",
      backHome: "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e",
    },
    error: {
      title: "\u0427\u0442\u043e-\u0442\u043e \u043f\u043e\u0448\u043b\u043e \u043d\u0435 \u0442\u0430\u043a",
      retry: "\u041f\u043e\u043f\u0440\u043e\u0431\u043e\u0432\u0430\u0442\u044c \u0441\u043d\u043e\u0432\u0430",
    },
    Metadata: {
      title: "PreLife \u2014 Premium Life",
      description: "\u0424\u0438\u0442\u043d\u0435\u0441, \u043f\u0438\u0442\u0430\u043d\u0438\u0435, \u043c\u0435\u0434\u0438\u0442\u0430\u0446\u0438\u044f \u0438 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430 \u2014 \u043d\u0430 \u043e\u0434\u043d\u043e\u0439 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435.",
    },
  },
};

mkdirSync(messagesDir, { recursive: true });

for (const locale of Object.keys(UI_NAMESPACES)) {
  const file = join(messagesDir, `${locale}.json`);
  let messages = {};
  if (existsSync(file)) {
    try {
      messages = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      console.error(`[FAIL] ${file}: invalid JSON - ${error.message}`);
      process.exit(1);
    }
  }
  for (const namespace of Object.keys(UI_NAMESPACES[locale])) {
    delete messages[namespace];
  }
  Object.assign(messages, UI_NAMESPACES[locale]);
  writeFileSync(file, JSON.stringify(messages, null, 2) + "\n", "utf8");
  console.log(`[OK] ${locale}: UI namespaces merged (${Object.keys(messages).length} top-level namespaces)`);
}

console.log("Done. Now run: node scripts/check-messages.mjs");
