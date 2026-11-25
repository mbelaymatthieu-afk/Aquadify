// App Store compliance strings, merged into the main dictionary.
export const releaseDict = {
  fr: {
    aiConsent: {
      title: "Autoriser l'IA ?",
      body: "Pour générer vos conseils, Aquadify envoie vos messages au coach et vos statistiques d'hydratation (objectif, quantités, séries) à ses fournisseurs d'IA tiers, Google Gemini et OpenAI. Vos données Apple Santé ne leur sont jamais transmises. Vous pouvez retirer cet accord à tout moment dans Profil.",
      accept: "J'accepte",
      privacy: "En savoir plus",
      setting: "Fonctions IA",
      settingHint: "Partage avec Google Gemini et OpenAI pour Aquacoach et Aquanalyse",
    },
    profile: {
      deleteAppleNote: "Un abonnement Apple se résilie séparément dans vos réglages Apple, sinon il reste facturé.",
      deleteGoogleNote: "Un abonnement Google Play se résilie séparément dans l'appli Google Play, sinon il reste facturé.",
    },
    premium: {
      f2: "Aquanalyse complète",
      f3: "Aucune publicité",
      unavailable: "Les abonnements ne sont pas disponibles pour le moment.",
      terms: "Conditions d'utilisation",
      legal: "Abonnement à renouvellement automatique. Le paiement est débité sur votre compte Apple à la confirmation ou à la fin de l'essai. Il se renouvelle au même prix sauf résiliation au moins 24 h avant la fin de la période.",
      legalAndroid: "Abonnement à renouvellement automatique. Le paiement est débité sur votre compte Google Play à la confirmation ou à la fin de l'essai. Il se renouvelle au même prix sauf résiliation avant la fin de la période.",
      cancelNoteAndroid: "Vous pouvez résilier votre abonnement à tout moment depuis l'appli Google Play (Paiements et abonnements).",
    },
  },
  en: {
    aiConsent: {
      title: "Allow AI?",
      body: "To generate your tips, Aquadify sends your coach messages and hydration statistics (goal, amounts, streaks) to its third-party AI providers, Google Gemini and OpenAI. Your Apple Health data is never sent to them. You can withdraw this consent at any time in Profile.",
      accept: "I agree",
      privacy: "Learn more",
      setting: "AI features",
      settingHint: "Shared with Google Gemini and OpenAI for Aquacoach and Aquanalyse",
    },
    profile: {
      deleteAppleNote: "An Apple subscription is cancelled separately in your Apple settings, otherwise it keeps being billed.",
      deleteGoogleNote: "A Google Play subscription is cancelled separately in the Google Play app, otherwise it keeps being billed.",
    },
    premium: {
      f2: "Full Aquanalyse",
      f3: "No ads",
      unavailable: "Subscriptions are not available right now.",
      terms: "Terms of Use",
      legal: "Auto-renewing subscription. Payment is charged to your Apple account at confirmation or at the end of the trial. It renews at the same price unless cancelled at least 24 hours before the end of the period.",
      legalAndroid: "Auto-renewing subscription. Payment is charged to your Google Play account at confirmation or at the end of the trial. It renews at the same price unless cancelled before the end of the period.",
      cancelNoteAndroid: "You can cancel your subscription anytime in the Google Play app (Payments & subscriptions).",
    },
  },
  es: {
    aiConsent: {
      title: "¿Permitir la IA?",
      body: "Para generar tus consejos, Aquadify envía tus mensajes al coach y tus estadísticas de hidratación (objetivo, cantidades, rachas) a sus proveedores de IA externos, Google Gemini y OpenAI. Tus datos de Apple Salud nunca se les envían. Puedes retirar este consentimiento en cualquier momento en Perfil.",
      accept: "Acepto",
      privacy: "Más información",
      setting: "Funciones de IA",
      settingHint: "Se comparte con Google Gemini y OpenAI para Aquacoach y Aquanalyse",
    },
    profile: {
      deleteAppleNote: "Una suscripción de Apple se cancela por separado en tus ajustes de Apple; si no, se sigue cobrando.",
      deleteGoogleNote: "Una suscripción de Google Play se cancela por separado en la app de Google Play; si no, se sigue cobrando.",
    },
    premium: {
      f2: "Aquanalyse completo",
      f3: "Sin anuncios",
      unavailable: "Las suscripciones no están disponibles por ahora.",
      terms: "Condiciones de uso",
      legal: "Suscripción con renovación automática. El pago se carga a tu cuenta de Apple al confirmar o al final de la prueba. Se renueva al mismo precio salvo cancelación al menos 24 h antes del final del periodo.",
      legalAndroid: "Suscripción con renovación automática. El pago se carga a tu cuenta de Google Play al confirmar o al final de la prueba. Se renueva al mismo precio salvo cancelación antes del final del periodo.",
      cancelNoteAndroid: "Puedes cancelar tu suscripción cuando quieras desde la app de Google Play (Pagos y suscripciones).",
    },
  },
} as const;
