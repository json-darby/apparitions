import { ScenarioType } from '../../types';

/**
 * Votive: the phrase candle for each conversation.
 *
 * Text written as a string is the same in both registers; `{ jij, u }` differs
 * between informal and formal. Inside phrases, `{slot}` marks a word the player
 * swaps for their own. Inside notes and advice, **bold** and `code` are rendered
 * as emphasis (see VotivePanel's `rich`).
 */

export type Register = 'jij' | 'u';
export type RegisterText = string | { jij: string; u: string };

export interface Phrase {
  nl: RegisterText;
  en: RegisterText;
  note?: string;
}

/** A line the character says, paired with a good reply. */
export interface Exchange {
  said: string;
  saidEn: string;
  reply: string;
  replyEn: string;
}

export interface VotiveSection {
  title: string;
  subtitle: string;
  phrases?: Phrase[];
  exchanges?: Exchange[];
}

export interface VotiveScene {
  code: string;
  name: string;
  place: string;
  advice: { jij: string; u: string };
  sections: VotiveSection[];
  pocket: { jij: string; u: string };
}

export const pickRegister = (text: RegisterText, register: Register) =>
  typeof text === 'string' ? text : text[register];

export const VOTIVE_SCENES: Record<ScenarioType, VotiveScene> = {
  [ScenarioType.INTRO]: {
    code: '01', name: 'The Encounter', place: 'Bus stop · late evening',
    advice: {
      jij: 'Dutch drop the formal fast. If Lotte says **je** to you, answer with **je**: sticking to u can feel distant.',
      u: 'A stranger, at night, older than you? Open with **u**. It is never rude, and she will tell you if you can switch.',
    },
    sections: [
      { title: 'Break the silence', subtitle: 'openers', phrases: [
        { nl: { jij: 'Hoi!', u: 'Goedenavond.' }, en: { jij: 'Hi!', u: 'Good evening.' } },
        { nl: 'Koud, hè?', en: 'Cold, isn’t it?', note: '“hè” turns any remark into an invitation to agree.' },
        { nl: { jij: 'Wacht je ook op de bus?', u: 'Wacht u ook op de bus?' }, en: 'Are you also waiting for the bus?' },
        { nl: { jij: 'Weet jij hoe laat hij komt?', u: 'Weet u hoe laat hij komt?' }, en: 'Do you know what time it comes?' },
      ]},
      { title: 'Ask about them', subtitle: 'questions', phrases: [
        { nl: { jij: 'Hoe gaat het met je?', u: 'Hoe gaat het met u?' }, en: 'How are you?' },
        { nl: { jij: 'Waar kom je vandaan?', u: 'Waar komt u vandaan?' }, en: 'Where are you from?' },
        { nl: { jij: 'Woon je hier in de buurt?', u: 'Woont u hier in de buurt?' }, en: 'Do you live around here?' },
        { nl: { jij: 'Wat doe je voor werk?', u: 'Wat doet u voor werk?' }, en: 'What do you do for work?' },
        { nl: { jij: 'Ga je naar huis?', u: 'Gaat u naar huis?' }, en: 'Are you heading home?' },
      ]},
      { title: 'Say who you are', subtitle: 'frames', phrases: [
        { nl: 'Ik heet {Sam}.', en: 'My name is ___.' },
        { nl: 'Ik kom uit {Engeland}.', en: 'I come from ___.' },
        { nl: 'Ik woon hier sinds {mei}.', en: 'I have lived here since ___.' },
        { nl: 'Ik leer Nederlands.', en: 'I am learning Dutch.' },
      ]},
      { title: 'React', subtitle: 'keep it alive', phrases: [
        { nl: { jij: 'Leuk!', u: 'Wat leuk.' }, en: 'Nice!' },
        { nl: { jij: 'Echt waar?', u: 'Is dat zo?' }, en: 'Really?' },
        { nl: 'Wat jammer.', en: 'What a shame.' },
        { nl: 'Dat klopt.', en: 'That’s right.' },
      ]},
      { title: 'When you’re lost', subtitle: 'repair', phrases: [
        { nl: { jij: 'Sorry, wat zei je?', u: 'Pardon, wat zei u?' }, en: 'Sorry, what did you say?' },
        { nl: { jij: 'Kun je langzamer praten?', u: 'Kunt u langzamer praten?' }, en: 'Can you speak more slowly?' },
        { nl: 'Wat betekent {bushalte}?', en: 'What does ___ mean?' },
      ]},
      { title: 'Part ways', subtitle: 'closing', phrases: [
        { nl: 'Daar komt de bus!', en: 'Here comes the bus!' },
        { nl: { jij: 'Leuk je te ontmoeten.', u: 'Leuk u te ontmoeten.' }, en: 'Nice to meet you.' },
        { nl: { jij: 'Fijne avond nog! Doei!', u: 'Nog een fijne avond. Tot ziens.' }, en: 'Have a good evening. Bye!' },
      ]},
    ],
    pocket: {
      jij: 'When `je` comes after the verb, the verb drops its `-t`: `jij woont` → `Woon je hier?`',
      u: '`u` always keeps the `-t`, wherever it stands: `u woont` → `Woont u hier?` Easier than jij.',
    },
  },

  [ScenarioType.COFFEE]: {
    code: '02', name: 'Night Shift', place: 'Café counter · after midnight',
    advice: {
      jij: 'In most Dutch cafés, staff your age say **je** straight away. Match it and you’ll sound local.',
      u: 'Use **u** in a smart restaurant, or with older staff. Adding **graag** is polite in both.',
    },
    sections: [
      { title: 'Order', subtitle: 'at the counter', phrases: [
        { nl: 'Mag ik een {koffie}?', en: 'Can I have a ___?' },
        { nl: { jij: 'Doe maar een cappuccino.', u: 'Ik zou graag een cappuccino willen.' }, en: { jij: 'I’ll go for a cappuccino.', u: 'I would like a cappuccino.' } },
        { nl: 'Met melk, graag.', en: 'With milk, please.' },
        { nl: 'Zonder suiker.', en: 'Without sugar.' },
        { nl: 'Een kleintje. / Een grote.', en: 'A small one. / A large one.' },
      ]},
      { title: 'Ask', subtitle: 'questions', phrases: [
        { nl: { jij: 'Wat raad je aan?', u: 'Wat raadt u aan?' }, en: 'What do you recommend?' },
        { nl: { jij: 'Heb je ook havermelk?', u: 'Heeft u ook havermelk?' }, en: 'Do you also have oat milk?' },
        { nl: 'Wat is lekker hier?', en: 'What’s good here?' },
        { nl: 'Is dit zonder vlees?', en: 'Is this meat-free?' },
      ]},
      { title: 'You’ll hear', subtitle: 'and what to say', exchanges: [
        { said: 'Wat mag het zijn?', saidEn: 'What will it be?', reply: 'Een thee, graag.', replyEn: 'A tea, please.' },
        { said: 'Voor hier of om mee te nemen?', saidEn: 'For here or to go?', reply: 'Voor hier.', replyEn: 'For here.' },
        { said: 'Anders nog iets?', saidEn: 'Anything else?', reply: 'Nee, dat was het.', replyEn: 'No, that’s all.' },
        { said: 'Pinnen of contant?', saidEn: 'Card or cash?', reply: 'Pinnen, graag.', replyEn: 'Card, please.' },
      ]},
      { title: 'Pay', subtitle: 'settling up', phrases: [
        { nl: 'Wat kost dat?', en: 'How much is that?' },
        { nl: 'Kan ik pinnen?', en: 'Can I pay by card?' },
        { nl: { jij: 'Alsjeblieft.', u: 'Alstublieft.' }, en: 'Here you go.', note: 'Also means “please”. Same word, both jobs.' },
        { nl: 'Laat maar zitten.', en: 'Keep the change.' },
      ]},
      { title: 'Warm up', subtitle: 'small talk', phrases: [
        { nl: 'Lekker!', en: 'Delicious!' },
        { nl: 'Wat gezellig hier.', en: 'It’s so cosy here.', note: 'Gezellig: cosy, sociable, warm. The most Dutch word there is.' },
        { nl: { jij: 'Werk je vaak ’s nachts?', u: 'Werkt u vaak ’s nachts?' }, en: 'Do you often work nights?' },
      ]},
      { title: 'Leave', subtitle: 'closing', phrases: [
        { nl: { jij: 'Top, dank je!', u: 'Dank u wel.' }, en: 'Thank you!' },
        { nl: { jij: 'Fijne dienst nog!', u: 'Nog een fijne avond.' }, en: { jij: 'Enjoy the rest of your shift!', u: 'Have a pleasant evening.' } },
      ]},
    ],
    pocket: {
      jij: '`graag` makes anything polite. `Een koffie, graag.` works even without a full sentence.',
      u: '`Ik zou graag … willen` is the politest order. The thing you want sits in the middle; `willen` goes last.',
    },
  },

  [ScenarioType.COMPREHENSION]: {
    code: '03', name: 'Deep Comprehension', place: 'A short story, then one question',
    advice: {
      jij: 'The Shadow tells a short story, then asks **one yes-or-no question**. Say **ja** or **nee**, then repeat its words to prove you understood.',
      u: 'Asking the Shadow to repeat? **u** suits its old, formal voice. Your answers about the story stay exactly the same.',
    },
    sections: [
      { title: 'Turn the question around', subtitle: 'yes or no, then echo', exchanges: [
        { said: 'Koopt Lotte vis?', saidEn: 'Does Lotte buy fish?', reply: 'Nee, ze koopt geen vis.', replyEn: 'No, she doesn’t buy fish.' },
        { said: 'Regent het?', saidEn: 'Is it raining?', reply: 'Ja, het regent.', replyEn: 'Yes, it is raining.' },
        { said: 'Is de kat zwart?', saidEn: 'Is the cat black?', reply: 'Nee, hij is niet zwart. Hij is wit.', replyEn: 'No, it isn’t black. It’s white.' },
        { said: 'Gaat Tom naar school?', saidEn: 'Does Tom go to school?', reply: 'Ja, hij gaat naar school.', replyEn: 'Yes, he goes to school.' },
      ]},
      { title: 'Answer shapes', subtitle: 'from short to full', phrases: [
        { nl: 'Ja. / Nee.', en: 'Yes. / No.', note: 'Enough to pass. The full sentence is where you actually practise.' },
        { nl: 'Ja, dat klopt. / Nee, dat klopt niet.', en: 'Yes, that’s right. / No, that’s not right.' },
        { nl: 'Ja, {ze koopt appels}.', en: 'Yes, ___.', note: 'Question: verb first. Answer: subject first, then the verb. `Koopt ze?` → `Ze koopt.`' },
        { nl: 'Nee, niet {vis}, maar {appels}.', en: 'No, not ___, but ___.', note: 'Correct the story: the strongest answer you can give.' },
      ]},
      { title: 'No: niet or geen?', subtitle: 'the one rule you need', phrases: [
        { nl: 'Ze heeft geen hond.', en: 'She has no dog.', note: '**geen** replaces **een**, or stands before a noun with no article.' },
        { nl: 'Hij eet geen brood.', en: 'He eats no bread.' },
        { nl: 'Het is niet koud.', en: 'It is not cold.', note: '**niet** for everything else: adjectives, verbs, places.' },
        { nl: 'Ze gaat niet naar de markt.', en: 'She doesn’t go to the market.' },
      ]},
      { title: 'Swap the names', subtitle: 'so you don’t repeat them', phrases: [
        { nl: 'Tom → hij · Lotte → ze', en: 'a man → he · a woman → she' },
        { nl: 'de kat → hij · het huis → het', en: 'de-words → hij · het-words → het' },
        { nl: 'de kinderen → ze', en: 'more than one → they' },
      ]},
      { title: 'Unsure? Still answer', subtitle: 'guessing counts', phrases: [
        { nl: 'Ik denk van wel.', en: 'I think so.' },
        { nl: 'Ik denk van niet.', en: 'I don’t think so.' },
        { nl: 'Ik denk dat {ze appels koopt}.', en: 'I think that ___.', note: 'After `dat` the verb goes to the end: `…dat ze appels koopt.`' },
      ]},
      { title: 'Words the stories use', subtitle: 'weather · food · animals · days', phrases: [
        { nl: 'Het regent · De zon schijnt · Het waait', en: 'It rains · The sun shines · It is windy' },
        { nl: 'eet · drinkt · koopt · kookt', en: 'eats · drinks · buys · cooks' },
        { nl: 'loopt · fietst · werkt · slaapt', en: 'walks · cycles · works · sleeps' },
      ]},
      { title: 'What the Shadow says back', subtitle: 'know your result', exchanges: [
        { said: 'Goed! / Precies!', saidEn: 'Good! / Exactly!', reply: 'A new story begins.', replyEn: 'Listen for the next one.' },
        { said: 'Nee, probeer het nog eens.', saidEn: 'No, try again.', reply: 'Same question again.', replyEn: 'Answer the other way.' },
      ]},
      { title: 'Ask the Shadow', subtitle: 'when you missed it', phrases: [
        { nl: { jij: 'Kun je het verhaal herhalen?', u: 'Kunt u het verhaal herhalen?' }, en: 'Can you repeat the story?' },
        { nl: { jij: 'Kun je de vraag herhalen?', u: 'Kunt u de vraag herhalen?' }, en: 'Can you repeat the question?' },
        { nl: 'Wat betekent {markt}?', en: 'What does ___ mean?' },
      ]},
    ],
    pocket: {
      jij: 'Echoing is the whole trick. `Koopt Lotte vis?` → swap Lotte for `ze`, put the verb after it, add `geen`: `Nee, ze koopt geen vis.`',
      u: 'Echoing is the whole trick. `Koopt Lotte vis?` → swap Lotte for `ze`, put the verb after it, add `geen`: `Nee, ze koopt geen vis.`',
    },
  },

  [ScenarioType.FREESPEECH]: {
    code: '04', name: 'Free Space', place: 'Anywhere · any topic',
    advice: {
      jij: 'An open conversation between equals: **je** is the natural choice.',
      u: 'Practising for work, an interview or an official call? Switch to **u** and rehearse it here.',
    },
    sections: [
      { title: 'Pick a topic', subtitle: 'starters', phrases: [
        { nl: 'Ik wil praten over {muziek}.', en: 'I want to talk about ___.' },
        { nl: 'Mag ik iets vragen?', en: 'Can I ask something?' },
        { nl: { jij: 'Wat vind jij van {Amsterdam}?', u: 'Wat vindt u van {Amsterdam}?' }, en: 'What do you think of ___?' },
      ]},
      { title: 'Give an opinion', subtitle: 'your take', phrases: [
        { nl: 'Ik vind het {interessant}.', en: 'I find it ___.' },
        { nl: 'Ik denk van wel. / Ik denk van niet.', en: 'I think so. / I don’t think so.' },
        { nl: { jij: 'Dat ben ik met je eens.', u: 'Dat ben ik met u eens.' }, en: 'I agree with you.' },
        { nl: 'Daar ben ik het niet mee eens.', en: 'I don’t agree with that.' },
      ]},
      { title: 'Keep it going', subtitle: 'follow-ups', phrases: [
        { nl: { jij: 'Vertel eens meer.', u: 'Kunt u daar meer over vertellen?' }, en: 'Tell me more.' },
        { nl: { jij: 'Hoe bedoel je?', u: 'Hoe bedoelt u?' }, en: 'What do you mean?' },
        { nl: { jij: 'En jij?', u: 'En u?' }, en: 'And you?' },
      ]},
      { title: 'Buy time', subtitle: 'when words run out', phrases: [
        { nl: 'Even denken…', en: 'Let me think…' },
        { nl: 'Hoe zeg je {cheerful} in het Nederlands?', en: 'How do you say ___ in Dutch?' },
        { nl: 'Ik bedoel…', en: 'I mean…' },
      ]},
      { title: 'Wrap up', subtitle: 'closing', phrases: [
        { nl: 'Het was leuk om te praten.', en: 'It was nice to talk.' },
        { nl: 'Tot de volgende keer!', en: 'Until next time!' },
      ]},
    ],
    pocket: {
      jij: '`vinden` is for opinions, not just “finding”: `Ik vind het leuk` = I like it. `Wat vind je?` = What do you think?',
      u: 'With u: `Wat vindt u?` The `-t` stays. Same rule as `Woont u`, `Heeft u`, `Kunt u`.',
    },
  },
};
