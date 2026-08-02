// The registry of every piece of the site the admin is allowed to change.
//
// This file is the security boundary as much as it is the config: the editor
// can only write a key that appears here, so a page with no slots (the invitee
// registration form, the navbar, the site title) is uneditable by construction
// — there is nothing to lock down, the capability simply does not exist.
//
// Each slot carries its own default, copied from the template it replaced. If
// the database row is missing, or MySQL is unreachable, the site renders the
// default and therefore looks exactly as it did before this feature existed.
//
// `max` is what keeps the layout intact. It is counted in visible characters
// (markup excluded) and enforced in three places: the editor blocks typing past
// it, the paste handler truncates to it, and the server rejects anything over
// it. Pick new values by asking "how much text fits before this column wraps
// badly on a phone", not by guessing.

// Slot types:
//   text  - plain text, escaped on output. No markup survives.
//   rich  - a tiny HTML subset (b/strong/i/em/u/br). Sanitised on write.
//   image - a URL under /img/ or /uploads/.
//   color - a #rrggbb value, injected as a CSS custom property. Deliberately
//           limited to the buttons: the owner asked on 2026-08-01 that body and
//           heading text keep the colours the design gives them, so there is no
//           colour slot for any paragraph. Do not add one back without asking.
const SLOT_TYPE = {
    TEXT: 'text',
    RICH: 'rich',
    IMAGE: 'image',
    COLOR: 'color'
};

const CONTENT_SLOTS = [

    // ---------------------------------------------------------------- Site

    {
        key: 'site.button.bg',
        type: SLOT_TYPE.COLOR,
        label: 'Couleur des boutons',
        // Shown on the small control that appears above a button on hover,
        // where there is only room for a word.
        short: 'Fond',
        cssVar: '--ls-btn-bg',
        default: '#7B1B38'
    },
    {
        key: 'site.button.text',
        type: SLOT_TYPE.COLOR,
        label: 'Couleur du texte des boutons',
        short: 'Texte',
        cssVar: '--ls-btn-text',
        default: '#ffffff'
    },

    // ------------------------------------------------------- Home / hero

    {
        key: 'home.hero.image',
        type: SLOT_TYPE.IMAGE,
        label: 'Photo principale',
        cssVar: '--ls-hero-image',
        default: '/img/main-img.jpg'
    },
    {
        key: 'home.hero.date1',
        type: SLOT_TYPE.TEXT,
        label: 'Première date',
        max: 16,
        default: '26.12.2026'
    },
    {
        // .location-title is white-space: nowrap inside a flex row that never
        // wraps, so this one really cannot grow. 30 fits the longest of the two
        // current values with room to spare.
        key: 'home.hero.location1',
        type: SLOT_TYPE.TEXT,
        label: 'Premier lieu',
        max: 30,
        default: "Abidjan, Côte d'Ivoire"
    },
    {
        key: 'home.hero.date2',
        type: SLOT_TYPE.TEXT,
        label: 'Deuxième date',
        max: 16,
        default: '02.01.2027'
    },
    {
        key: 'home.hero.location2',
        type: SLOT_TYPE.TEXT,
        label: 'Deuxième lieu',
        max: 30,
        default: 'Ouagadougou, Burkina Faso'
    },

    // --------------------------------------------------- Home / Notre Mariage

    {
        key: 'home.mariage.title',
        type: SLOT_TYPE.TEXT,
        label: 'Titre « Notre Mariage »',
        max: 40,
        default: 'Notre Mariage'
    },
    {
        key: 'home.mariage.text',
        type: SLOT_TYPE.RICH,
        label: 'Texte « Notre Mariage »',
        max: 900,
        default: 'C’est avec une grande joie que nous vous annonçons notre mariage. '
            + 'La cérémonie traditionnelle aura lieu le Samedi <b>26 Décembre 2026 à Abidjan</b>, '
            + 'et le mariage civil se tiendra le Samedi <b>2 Janvier 2027 à Ouagadougou</b>. '
            + 'Nous serons très heureux de célébrer ces moments uniques entourés de ceux que nous aimons.'
            + '<br><u>Cliquer sur "S\'enregistrer" pour confirmer votre place</u>'
    },
    {
        key: 'home.mariage.button',
        type: SLOT_TYPE.TEXT,
        label: 'Bouton d’inscription',
        max: 26,
        default: "S'enregistrer"
    },
    {
        key: 'home.mariage.image',
        type: SLOT_TYPE.IMAGE,
        label: 'Photo « Notre Mariage »',
        default: '/img/couple-2.JPG'
    },
    {
        // The wide decorative strip under the "S'enregistrer" button. It used to
        // be a ::after pseudo-element, which cannot be hovered or targeted, so
        // it was turned into a real .border-strip div to make it editable.
        key: 'home.mariage.strip',
        type: SLOT_TYPE.IMAGE,
        label: 'Bandeau sous le bouton « S’enregistrer »',
        default: '/img/main-img.jpg'
    },

    // -------------------------------------------------------- Home / Cadeaux

    {
        key: 'home.gift.title',
        type: SLOT_TYPE.TEXT,
        label: 'Titre « Cadeaux »',
        max: 40,
        default: 'Cadeaux'
    },
    {
        key: 'home.gift.text',
        type: SLOT_TYPE.RICH,
        label: 'Texte « Cadeaux »',
        max: 900,
        default: 'Si vous le souhaitez, nous privilégions les dons en espèces, ou une '
            + 'contribution à l’organisation du mariage via notre liste de souhaits, puisque '
            + "nous vivons à l'étranger. Toute participation est entièrement volontaire. Merci "
            + 'du fond du cœur pour votre amour et votre soutien. Nous avons hâte de partager ce '
            + 'bonheur avec vous!'
            + '<br><b>Cliquez sur offrir pour voir les moyens de nous offrir un cadeau.</b>'
    },
    {
        key: 'home.gift.image',
        type: SLOT_TYPE.IMAGE,
        label: 'Photo « Cadeaux »',
        default: '/img/couple-3.png'
    },
    {
        // Same story as home.mariage.strip — the strip under the "Cliquez sur
        // offrir…" paragraph.
        key: 'home.gift.strip',
        type: SLOT_TYPE.IMAGE,
        label: 'Bandeau sous le texte « Cadeaux »',
        default: '/img/couple-1.JPG'
    },
    {
        key: 'home.gift.cta',
        type: SLOT_TYPE.RICH,
        label: 'Phrase au-dessus du bouton « Offrir »',
        max: 220,
        default: 'Envie de faire plaisir aux mariés&nbsp;? Cliquez sur le bouton ci-dessous '
            + 'pour nous offrir un cadeau.'
    },
    {
        key: 'home.gift.button',
        type: SLOT_TYPE.TEXT,
        label: 'Bouton « Offrir »',
        max: 26,
        default: 'Offrir'
    },

    // ------------------------------------------------------- Home / Programme

    {
        key: 'home.program.title',
        type: SLOT_TYPE.TEXT,
        label: 'Titre « Programme »',
        max: 40,
        default: 'Programme'
    },
    {
        // The timeline entries live in a col-5, so they are the narrowest text
        // column on the site. Keep these limits tight.
        key: 'home.program.item1.title',
        type: SLOT_TYPE.TEXT,
        label: 'Programme — titre 1',
        max: 32,
        default: 'Église'
    },
    {
        key: 'home.program.item1.text',
        type: SLOT_TYPE.RICH,
        label: 'Programme — détails 1',
        max: 320,
        default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Alias odio,'
    },
    {
        key: 'home.program.item2.title',
        type: SLOT_TYPE.TEXT,
        label: 'Programme — titre 2',
        max: 32,
        default: 'Mairie'
    },
    {
        key: 'home.program.item2.text',
        type: SLOT_TYPE.RICH,
        label: 'Programme — détails 2',
        max: 320,
        default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Alias odio,'
    },
    {
        key: 'home.program.item3.title',
        type: SLOT_TYPE.TEXT,
        label: 'Programme — titre 3',
        max: 32,
        default: 'Réception'
    },
    {
        key: 'home.program.item3.text',
        type: SLOT_TYPE.RICH,
        label: 'Programme — détails 3',
        max: 320,
        default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Alias odio, lore'
    },

    // --------------------------------------------------- Home / Notre Histoire

    {
        key: 'home.story.title',
        type: SLOT_TYPE.TEXT,
        label: 'Titre « Notre Histoire »',
        max: 40,
        default: 'Notre Histoire'
    },
    {
        key: 'home.story.text1',
        type: SLOT_TYPE.RICH,
        label: 'Notre Histoire — paragraphe 1',
        max: 700,
        default: 'Tout a commencé en 2019 à l’université… pas vraiment le genre d’endroit où '
            + 'l’on s’attend à rencontrer l’amour de sa vie, et pourtant. De rencontres en '
            + 'rencontres, quelque chose de particulier s’est installé. Une évidence discrète, '
            + 'un lien qui s’est construit sans faire de bruit.'
    },
    {
        key: 'home.story.image1',
        type: SLOT_TYPE.IMAGE,
        label: 'Notre Histoire — photo 1',
        default: '/img/couple-9.JPG'
    },
    {
        key: 'home.story.text2',
        type: SLOT_TYPE.RICH,
        label: 'Notre Histoire — paragraphe 2',
        max: 700,
        default: 'En mai 2019, nous avons fait le choix de nous écrire une vraie histoire. Et '
            + 'depuis, la vie nous a surtout offert ce qu’elle a de plus beau : de l’amour, des '
            + 'rires, de la complicité, et une façon bien à nous d’avancer ensemble.'
    },
    {
        key: 'home.story.image2',
        type: SLOT_TYPE.IMAGE,
        label: 'Notre Histoire — photo 2',
        default: '/img/couple-7.JPG'
    },
    {
        key: 'home.story.text3',
        type: SLOT_TYPE.RICH,
        label: 'Notre Histoire — paragraphe 3',
        max: 700,
        default: 'Aujourd’hui, sept ans plus tard, nous sommes là. Au début d’un “pour toujours” '
            + 'que nous avons choisi, ensemble.'
    },
    {
        key: 'home.story.image3',
        type: SLOT_TYPE.IMAGE,
        label: 'Notre Histoire — photo 3',
        default: '/img/couple-10.JPG'
    },

    // ------------------------------------------------------------ Give page

    {
        key: 'give.title',
        type: SLOT_TYPE.TEXT,
        label: 'Titre de la page « Offrir »',
        max: 50,
        default: 'Merci de ton geste'
    },
    {
        // The large photo beside the payment methods. It is a CSS background on
        // .main-img rather than an <img>, so it is driven by a custom property
        // like the hero and the two strips.
        key: 'give.image',
        type: SLOT_TYPE.IMAGE,
        label: 'Photo de la page « Offrir »',
        default: '/img/webp/couple-2.webp'
    },
    {
        key: 'give.intro',
        type: SLOT_TYPE.RICH,
        label: 'Introduction « Offrir »',
        max: 400,
        default: "Pour nous faire une donation, vous pouvez utiliser l'un des moyens de "
            + 'paiement ci-dessous :'
    },
    {
        key: 'give.wave.title',
        type: SLOT_TYPE.TEXT,
        label: 'Wave — titre',
        max: 40,
        default: 'Détails Wave:'
    },
    {
        key: 'give.wave.phone',
        type: SLOT_TYPE.TEXT,
        label: 'Wave — téléphone',
        max: 30,
        default: '+1 343 434 5455'
    },
    {
        key: 'give.wave.name',
        type: SLOT_TYPE.TEXT,
        label: 'Wave — nom',
        max: 50,
        default: 'Moussa Zombré'
    },
    {
        key: 'give.orange.title',
        type: SLOT_TYPE.TEXT,
        label: 'Orange Money — titre',
        max: 40,
        default: 'Détails Orange Money:'
    },
    {
        key: 'give.orange.phone',
        type: SLOT_TYPE.TEXT,
        label: 'Orange Money — téléphone',
        max: 30,
        default: '+1 343 434 5455'
    },
    {
        key: 'give.orange.name',
        type: SLOT_TYPE.TEXT,
        label: 'Orange Money — nom',
        max: 50,
        default: 'Moussa Zombré'
    },
    {
        key: 'give.interac.title',
        type: SLOT_TYPE.TEXT,
        label: 'Interac — titre',
        max: 40,
        default: 'Détails Interac:'
    },
    {
        key: 'give.interac.phone',
        type: SLOT_TYPE.TEXT,
        label: 'Interac — téléphone',
        max: 30,
        default: '+1 343 434 5455'
    },
    {
        key: 'give.interac.email',
        type: SLOT_TYPE.TEXT,
        label: 'Interac — adresse e-mail',
        max: 60,
        default: 'sheridan@test.com'
    },
    {
        key: 'give.interac.name',
        type: SLOT_TYPE.TEXT,
        label: 'Interac — nom',
        max: 50,
        default: 'Moussa Zombré'
    }
];

const SLOTS_BY_KEY = new Map(CONTENT_SLOTS.map((slot) => [slot.key, slot]));

// Colour slots are emitted as CSS custom properties in <head>, so the
// stylesheets stay the single owner of *how* things look — the admin only
// supplies a value the stylesheet already knows what to do with.
const COLOR_SLOTS = CONTENT_SLOTS.filter((slot) => slot.cssVar != null);

function getSlot(key) {
    return SLOTS_BY_KEY.get(key) ?? null;
}

function isKnownSlot(key) {
    return SLOTS_BY_KEY.has(key);
}

// "home.gift.title" -> "home". Used to scope the "reset this page" action.
function getSlotPage(key) {
    return key.split('.')[0];
}

function getSlotKeysForPage(page) {
    return CONTENT_SLOTS
        .filter((slot) => getSlotPage(slot.key) === page)
        .map((slot) => slot.key);
}

export {
    SLOT_TYPE,
    CONTENT_SLOTS,
    COLOR_SLOTS,
    getSlot,
    isKnownSlot,
    getSlotPage,
    getSlotKeysForPage
};
