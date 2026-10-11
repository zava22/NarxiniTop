/* Tashkent districts. districtKey() maps free text (uz/ru/en spellings, as returned by
 * addresses or by OpenStreetMap) to a stable key, so branches WITHOUT coordinates can still be
 * matched to the user's district. */
export const DISTRICTS = {
  almazar: "Olmazor", bektemir: "Bektemir", mirobod: "Mirobod", ulugbek: "Mirzo Ulug‘bek", sergeli: "Sergeli",
  uchtepa: "Uchtepa", shayxontohur: "Shayxontohur", chilonzor: "Chilonzor", yunusobod: "Yunusobod",
  yakkasaroy: "Yakkasaroy", yashnobod: "Yashnobod", yangihayot: "Yangihayot",
};
const RULES = [
  ["almazar", /almazar|olmazor|алмазар|олмазор/],
  ["bektemir", /bektemir|бектемир/],
  ["mirobod", /mirobod|mirabad|мирабад|миробод/],
  ["ulugbek", /ulug.?bek|улугбек|улуғбек/],
  ["sergeli", /sergel|сергел/],
  ["uchtepa", /uchtepa|учтепа/],
  ["shayxontohur", /shayxontohur|shaykhontohur|shaykhantakhur|shayhontohur|шайхантахур|шайхонтохур/],
  ["chilonzor", /chilonzor|chilanzar|чиланзар|чилонзор/],
  ["yunusobod", /yunusobod|yunusabad|юнусабад|юнусобод/],
  ["yakkasaroy", /yakkasaroy|yakkasaray|яккасарай|яккасарой/],
  ["yashnobod", /yashnobod|yashnabad|яшнабад|яшнобод/],
  ["yangihayot", /yangihayot|yangi hayot|янгихаёт|янгиха/],
];
export function districtKey(text) {
  if (typeof text !== "string") return null;
  const s = text.toLowerCase().replace(/[‘’ʻʼ'`]/g, "");
  for (const [k, re] of RULES) if (re.test(s)) return k;
  return null;
}
