import { validateModel, type Model } from '../domain/model';

const lanternRules = [
  { id: 'market', text: 'The market has inexhaustible ore and glass. Without a guild seal, a bundle of one ore and one glass costs 10.00 crowns. With a guild seal, you must spend it and pay 8.00 crowns for the bundle. You may buy only with no materials, lantern or pending receipt.' },
  { id: 'forge', text: 'Crafting consumes one ore and one glass and produces one lantern and one pending maker receipt. You must have no lantern and no pending receipt.' },
  { id: 'guild', text: 'With a lantern and a pending receipt, claim a 3.00 crown maker reward and one guild seal, consuming the receipt. This reward is repeatable for every newly crafted lantern, with inexhaustible guild funds.' },
  { id: 'exchange', text: 'The exchange buys a lantern for 6.00 crowns, but only after its maker receipt has been claimed. It has inexhaustible funds and demand.' },
  { id: 'limits', text: 'Start with 10.00 crowns, one guild seal and nothing else. Inventory holds at most one ore, one glass and one lantern. Seal and pending receipt each have capacity one. Every action costs one turn. There is no turn limit, cooldown, currency cap, or other stock or reward limit.' },
];
const empty = [{ field: 'ore', op: 'eq' as const, value: '0' }, { field: 'glass', op: 'eq' as const, value: '0' }, { field: 'lantern', op: 'eq' as const, value: '0' }, { field: 'receipt', op: 'eq' as const, value: '0' }];
export const LANTERN: Model = validateModel({
  schemaVersion: 1, name: 'The Lantern Guild', description: 'A maker grant, a guild discount, and a very generous buyback desk. Individually reasonable. Together, expensive.',
  source: lanternRules.map(r => r.text).join('\n\n'), currency: { label: 'crowns', decimals: 2 }, rules: lanternRules,
  resources: [{ id: 'ore', label: 'Ore', kind: 'item', max: 1 }, { id: 'glass', label: 'Glass', kind: 'item', max: 1 }, { id: 'lantern', label: 'Lantern', kind: 'item', max: 1 }, { id: 'seal', label: 'Guild seal', kind: 'flag', max: 1 }, { id: 'receipt', label: 'Maker receipt', kind: 'flag', max: 1 }],
  initial: { currency: '1000', resources: { ore: 0, glass: 0, lantern: 0, seal: 1, receipt: 0 }, turn: 0 }, maxTurns: null, assumptions: [],
  actions: [
    { id: 'buy_discount', label: 'Buy with guild seal', kind: 'buy', ruleIds: ['market', 'limits'], requires: [...empty, { field: 'seal', op: 'eq', value: '1' }], currencyDelta: '-800', deltas: { ore: 1, glass: 1, seal: -1 } },
    { id: 'buy_standard', label: 'Buy at full price', kind: 'buy', ruleIds: ['market', 'limits'], requires: [...empty, { field: 'seal', op: 'eq', value: '0' }], currencyDelta: '-1000', deltas: { ore: 1, glass: 1 } },
    { id: 'craft', label: 'Craft a lantern', kind: 'craft', ruleIds: ['forge', 'limits'], requires: [{ field: 'lantern', op: 'eq', value: '0' }, { field: 'receipt', op: 'eq', value: '0' }], currencyDelta: '0', deltas: { ore: -1, glass: -1, lantern: 1, receipt: 1 } },
    { id: 'claim', label: 'Claim maker reward', kind: 'reward', ruleIds: ['guild', 'limits'], requires: [{ field: 'lantern', op: 'eq', value: '1' }, { field: 'receipt', op: 'eq', value: '1' }], currencyDelta: '300', deltas: { receipt: -1, seal: 1 } },
    { id: 'sell', label: 'Sell the lantern', kind: 'sell', ruleIds: ['exchange', 'limits'], requires: [{ field: 'receipt', op: 'eq', value: '0' }], currencyDelta: '600', deltas: { lantern: -1 } },
  ],
});
export function repairLantern(input: Model = LANTERN): Model {
  const model = structuredClone(input);
  const rule = model.rules.find(r => r.id === 'guild')!;
  const oldText = rule.text; rule.text = rule.text.replace('3.00 crown', '1.00 crown');
  model.source = model.source.replace(oldText, rule.text); model.actions.find(a => a.id === 'claim')!.currencyDelta = '100';
  return validateModel(model);
}
const pearlRules = [
  { id: 'shop', text: 'Buy a pearl for 5.00 coins from stock. Sell a pearl back for 5.00 coins, returning it to stock. No fees, rewards or discounts apply.' },
  { id: 'limits', text: 'Start with 10.00 coins, zero pearls and shop stock of two pearls. You can hold two pearls and shop stock is capped at two. Every action costs one turn, with a six-turn limit. There are no other actions.' },
];
const pearl: Model = validateModel({ schemaVersion: 1, name: 'Stillwater Pearl Market', description: 'A closed, finite exchange. Nothing up its sleeve.', source: pearlRules.map(r => r.text).join('\n\n'), rules: pearlRules, currency: { label: 'coins', decimals: 2 }, resources: [{ id: 'pearl', label: 'Pearl', kind: 'item', max: 2 }, { id: 'stock', label: 'Market stock', kind: 'stock', max: 2 }], initial: { currency: '1000', resources: { pearl: 0, stock: 2 }, turn: 0 }, maxTurns: 6, assumptions: [], actions: [
  { id: 'buy', label: 'Buy pearl', kind: 'buy', ruleIds: ['shop', 'limits'], requires: [], currencyDelta: '-500', deltas: { pearl: 1, stock: -1 } },
  { id: 'sell', label: 'Sell pearl', kind: 'sell', ruleIds: ['shop', 'limits'], requires: [], currencyDelta: '500', deltas: { pearl: -1, stock: 1 } },
] });
const emberRules = [
  { id: 'trade', text: 'Buy one ember for 0.10 sparks from an inexhaustible supply. Convert two embers into one prism. Sell a prism for 0.20 sparks to an inexhaustible buyer.' },
  { id: 'welcome', text: 'While holding a prism, spend your single welcome token to receive 0.05 sparks. This benefit can be claimed only once and is never replenished.' },
  { id: 'limits', text: 'Start with 1.00 sparks, no items, and one welcome token. Hold at most two embers, one prism and one welcome token. All actions cost one turn. Turns are uncapped; there are no other conditions, rewards or currency caps.' },
];
const ember: Model = validateModel({ schemaVersion: 1, name: 'Emberworks Welcome Desk', description: 'A profitable welcome gift is not an infinite-money glitch. Track the token.', source: emberRules.map(r => r.text).join('\n\n'), rules: emberRules, currency: { label: 'sparks', decimals: 2 }, resources: [{ id: 'ember', label: 'Ember', kind: 'item', max: 2 }, { id: 'prism', label: 'Prism', kind: 'item', max: 1 }, { id: 'welcome', label: 'Welcome token', kind: 'flag', max: 1 }], initial: { currency: '100', resources: { ember: 0, prism: 0, welcome: 1 }, turn: 0 }, maxTurns: null, assumptions: [], actions: [
  { id: 'buy', label: 'Buy ember', kind: 'buy', ruleIds: ['trade', 'limits'], requires: [], currencyDelta: '-10', deltas: { ember: 1 } },
  { id: 'convert', label: 'Fuse prism', kind: 'convert', ruleIds: ['trade', 'limits'], requires: [], currencyDelta: '0', deltas: { ember: -2, prism: 1 } },
  { id: 'reward', label: 'Claim welcome gift', kind: 'reward', ruleIds: ['welcome', 'limits'], requires: [{ field: 'prism', op: 'eq', value: '1' }], currencyDelta: '5', deltas: { welcome: -1 } },
  { id: 'sell', label: 'Sell prism', kind: 'sell', ruleIds: ['trade', 'limits'], requires: [], currencyDelta: '20', deltas: { prism: -1 } },
] });
export const SAMPLES: { id: string; label: string; subtitle: string; model: Model }[] = [
  { id: 'lantern', label: 'The Lantern Guild', subtitle: 'A repeatable loophole across four rules', model: LANTERN },
  { id: 'lantern_repaired', label: 'The Lantern Guild · patched', subtitle: 'Same gameplay, smaller reward', model: repairLantern() },
  { id: 'pearl', label: 'Stillwater Pearl Market', subtitle: 'A fully bounded negative control', model: pearl },
  { id: 'ember', label: 'Emberworks Welcome Desk', subtitle: 'Finite benefit, not infinite profit', model: ember },
];
