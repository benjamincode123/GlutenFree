import type { Locale } from '../i18n/translations';

export type TermsSection = {
  title: string;
  body: string;
};

export function getTermsSections(locale: Locale): TermsSection[] {
  return locale === 'nb' ? SECTIONS_NB : SECTIONS_EN;
}

const SECTIONS_NB: TermsSection[] = [
  {
    title: '1. Avtale',
    body:
      'Ved å bruke AltUten («appen») bekrefter du at du har lest, forstått og godtatt disse vilkårene og ansvarsfraskrivelsen. Hvis du ikke godtar dem, må du ikke bruke appen.',
  },
  {
    title: '2. Hva appen er',
    body:
      'AltUten er et hjelpeverktøy som viser produktinformasjon basert på strekkoder og katalogdata (blant annet ingredienser, allergener og opprinnelse når det er tilgjengelig). Informasjonen kan komme fra flere kilder, inkludert brukerinnhold og tredjepartsdata, og kan være ufullstendig, utdatert eller feil.',
  },
  {
    title: '3. Ikke medisinsk råd',
    body:
      'Appen gir ikke medisinsk råd, diagnose eller behandling. Den er ikke en erstatning for merking på emballasje, råd fra helsepersonell, eller din egen vurdering. Ved allergi, intoleranse eller helseproblemer skal du alltid følge emballasjen og eventuelt råd fra lege eller annet kvalifisert helsepersonell.',
  },
  {
    title: '4. Ditt ansvar',
    body:
      'Du er selv ansvarlig for beslutninger om hva du spiser eller unngår. Du må alltid kontrollere produktets emballasje, ingrediensliste og allergenmerking før bruk. Du skal ikke stole utelukkende på appen ved alvorlig allergi eller annen risiko for helseskade.',
  },
  {
    title: '5. Ansvarsfraskrivelse',
    body:
      'I den utstrekning loven tillater det, fraskriver AltUten, eiere, utviklere, bidragsytere og samarbeidspartnere seg ethvert ansvar for tap, skade, sykdom, allergisk reaksjon, død eller andre følger som oppstår som følge av bruk av appen eller tillit til informasjon i appen — herunder feil, mangler eller manglende allergener og annen produktinformasjon.\n\nAppen leveres «som den er» og «som tilgjengelig», uten garantier om riktighet, fullstendighet, aktualitet eller egnethet for et bestemt formål.',
  },
  {
    title: '6. Innhold og feil',
    body:
      'Produktinformasjon kan være feil eller mangelfull. Vi tilstreber å forbedre kvaliteten, men garanterer ikke at opplysninger er korrekte. Du oppfordres til å rapportere feil via funksjonene i appen. Retting kan ta tid, og midlertidig feilinformasjon kan fortsatt være synlig.',
  },
  {
    title: '7. Brukerkonto og akseptabel bruk',
    body:
      'Hvis du har konto, er du ansvarlig for innloggingen din og for at opplysninger du sender inn er så korrekte som mulig. Du skal ikke misbruke appen, forsøke å skade tjenesten, eller bevisst legge inn villedende informasjon.',
  },
  {
    title: '8. Personvern',
    body:
      'Vi behandler personopplysninger som er nødvendige for konto, drift og forbedring av tjenesten, i tråd med gjeldende personvernregelverk. Mer detaljert personvernerklæring kan legges til eller oppdateres senere.',
  },
  {
    title: '9. Endringer',
    body:
      'Vi kan oppdatere disse vilkårene. Ved vesentlige endringer kan du bli bedt om å godta den nye versjonen før du fortsetter å bruke appen. Fortsatt bruk etter at du har godtatt en ny versjon betyr at du godtar de oppdaterte vilkårene.',
  },
  {
    title: '10. Lovvalg',
    body:
      'Disse vilkårene er underlagt norsk rett, med forbehold om ufravikelige forbrukerrettigheter som gjelder der du bor. Ingenting i denne avtalen begrenser rettigheter du har etter ufravikelig lov.',
  },
  {
    title: '11. Kontakt',
    body:
      'Spørsmål om disse vilkårene kan rettes til AltUten via kontaktkanalene som er oppgitt på nettsiden eller i appen.',
  },
];

const SECTIONS_EN: TermsSection[] = [
  {
    title: '1. Agreement',
    body:
      'By using AltUten (the “App”), you confirm that you have read, understood, and agreed to these Terms and the disclaimer. If you do not agree, you must not use the App.',
  },
  {
    title: '2. What the App is',
    body:
      'AltUten is a helper tool that shows product information based on barcodes and catalog data (including ingredients, allergens, and origin when available). Information may come from multiple sources, including user submissions and third-party data, and may be incomplete, outdated, or incorrect.',
  },
  {
    title: '3. Not medical advice',
    body:
      'The App does not provide medical advice, diagnosis, or treatment. It is not a substitute for on-pack labelling, advice from healthcare professionals, or your own judgement. If you have allergies, intolerances, or other health concerns, always follow the packaging and seek medical advice when needed.',
  },
  {
    title: '4. Your responsibility',
    body:
      'You are solely responsible for decisions about what you eat or avoid. You must always check the product packaging, ingredient list, and allergen labelling before use. You must not rely solely on the App if you have severe allergies or any other risk of harm.',
  },
  {
    title: '5. Disclaimer of liability',
    body:
      'To the fullest extent permitted by law, AltUten, its owners, developers, contributors, and partners disclaim all liability for loss, injury, illness, allergic reaction, death, or any other consequence arising from use of the App or reliance on information in the App — including errors, omissions, or missing allergens and other product information.\n\nThe App is provided “as is” and “as available”, without warranties of accuracy, completeness, timeliness, or fitness for a particular purpose.',
  },
  {
    title: '6. Content and errors',
    body:
      'Product information may be wrong or incomplete. We aim to improve quality but do not guarantee correctness. Please report errors using the in-app tools. Corrections may take time, and incorrect information may remain visible temporarily.',
  },
  {
    title: '7. Account and acceptable use',
    body:
      'If you have an account, you are responsible for your login and for making submitted information as accurate as reasonably possible. You must not misuse the App, attempt to harm the service, or knowingly submit misleading information.',
  },
  {
    title: '8. Privacy',
    body:
      'We process personal data needed for accounts, operation, and improvement of the service, in line with applicable privacy law. A more detailed privacy notice may be added or updated later.',
  },
  {
    title: '9. Changes',
    body:
      'We may update these Terms. For material changes, you may be asked to accept the new version before continuing. Continued use after you accept a new version means you agree to the updated Terms.',
  },
  {
    title: '10. Governing law',
    body:
      'These Terms are governed by Norwegian law, without limiting mandatory consumer rights that apply where you live. Nothing in this agreement limits rights you have under mandatory law.',
  },
  {
    title: '11. Contact',
    body:
      'Questions about these Terms can be sent to AltUten via the contact channels listed on the website or in the App.',
  },
];
