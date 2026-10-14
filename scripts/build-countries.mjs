// Generates data/geography/countries.json. Run: node scripts/build-countries.mjs
import { mkdir, writeFile } from 'node:fs/promises';

// Name|Capital|Continent|name alts,..|capital alts,..
const RAW = `
Afghanistan|Kabul|Asia
Albania|Tirana|Europe
Algeria|Algiers|Africa
Andorra|Andorra la Vella|Europe
Angola|Luanda|Africa
Antigua and Barbuda|Saint John's|North America|Antigua|St John's,St. John's
Argentina|Buenos Aires|South America
Armenia|Yerevan|Asia
Australia|Canberra|Oceania
Austria|Vienna|Europe||Wien
Azerbaijan|Baku|Asia
Bahamas|Nassau|North America|The Bahamas
Bahrain|Manama|Asia
Bangladesh|Dhaka|Asia||Dacca
Barbados|Bridgetown|North America
Belarus|Minsk|Europe
Belgium|Brussels|Europe||Bruxelles
Belize|Belmopan|North America
Benin|Porto-Novo|Africa||Porto Novo
Bhutan|Thimphu|Asia
Bolivia|Sucre|South America||La Paz
Bosnia and Herzegovina|Sarajevo|Europe|Bosnia
Botswana|Gaborone|Africa
Brazil|Brasília|South America
Brunei|Bandar Seri Begawan|Asia
Bulgaria|Sofia|Europe
Burkina Faso|Ouagadougou|Africa
Burundi|Gitega|Africa||Bujumbura
Cabo Verde|Praia|Africa|Cape Verde
Cambodia|Phnom Penh|Asia
Cameroon|Yaoundé|Africa||Yaounde
Canada|Ottawa|North America
Central African Republic|Bangui|Africa
Chad|N'Djamena|Africa||Ndjamena
Chile|Santiago|South America
China|Beijing|Asia||Peking
Colombia|Bogotá|South America||Bogota
Comoros|Moroni|Africa
Democratic Republic of the Congo|Kinshasa|Africa|DR Congo,DRC,Congo-Kinshasa
Republic of the Congo|Brazzaville|Africa|Congo,Congo-Brazzaville
Costa Rica|San José|North America||San Jose
Côte d'Ivoire|Yamoussoukro|Africa|Ivory Coast,Cote d'Ivoire|Abidjan
Croatia|Zagreb|Europe
Cuba|Havana|North America||La Habana
Cyprus|Nicosia|Europe
Czechia|Prague|Europe|Czech Republic|Praha
Denmark|Copenhagen|Europe||København
Djibouti|Djibouti|Africa||Djibouti City
Dominica|Roseau|North America
Dominican Republic|Santo Domingo|North America
Ecuador|Quito|South America
Egypt|Cairo|Africa
El Salvador|San Salvador|North America
Equatorial Guinea|Malabo|Africa||Ciudad de la Paz
Eritrea|Asmara|Africa
Estonia|Tallinn|Europe
Eswatini|Mbabane|Africa|Swaziland|Lobamba
Ethiopia|Addis Ababa|Africa
Fiji|Suva|Oceania
Finland|Helsinki|Europe
France|Paris|Europe
Gabon|Libreville|Africa
Gambia|Banjul|Africa|The Gambia
Georgia|Tbilisi|Asia
Germany|Berlin|Europe
Ghana|Accra|Africa
Greece|Athens|Europe
Grenada|St. George's|North America||Saint George's,St George's,St Georges
Guatemala|Guatemala City|North America||Ciudad de Guatemala
Guinea|Conakry|Africa
Guinea-Bissau|Bissau|Africa|Guinea Bissau
Guyana|Georgetown|South America
Haiti|Port-au-Prince|North America||Port au Prince
Honduras|Tegucigalpa|North America
Hungary|Budapest|Europe
Iceland|Reykjavík|Europe||Reykjavik
India|New Delhi|Asia||Delhi
Indonesia|Jakarta|Asia||Nusantara
Iran|Tehran|Asia||Teheran
Iraq|Baghdad|Asia
Ireland|Dublin|Europe
Israel|Jerusalem|Asia
Italy|Rome|Europe||Roma
Jamaica|Kingston|North America
Japan|Tokyo|Asia
Jordan|Amman|Asia
Kazakhstan|Astana|Asia||Nur-Sultan,Nursultan
Kenya|Nairobi|Africa
Kiribati|Tarawa|Oceania||South Tarawa
Kuwait|Kuwait City|Asia
Kyrgyzstan|Bishkek|Asia
Laos|Vientiane|Asia
Latvia|Riga|Europe
Lebanon|Beirut|Asia
Lesotho|Maseru|Africa
Liberia|Monrovia|Africa
Libya|Tripoli|Africa
Liechtenstein|Vaduz|Europe
Lithuania|Vilnius|Europe
Luxembourg|Luxembourg|Europe||Luxembourg City
Madagascar|Antananarivo|Africa
Malawi|Lilongwe|Africa
Malaysia|Kuala Lumpur|Asia
Maldives|Malé|Asia||Male
Mali|Bamako|Africa
Malta|Valletta|Europe
Marshall Islands|Majuro|Oceania
Mauritania|Nouakchott|Africa
Mauritius|Port Louis|Africa
Mexico|Mexico City|North America||Ciudad de México
Micronesia|Palikir|Oceania|Federated States of Micronesia
Moldova|Chișinău|Europe||Chisinau
Monaco|Monaco|Europe
Mongolia|Ulaanbaatar|Asia||Ulan Bator
Montenegro|Podgorica|Europe
Morocco|Rabat|Africa
Mozambique|Maputo|Africa
Myanmar|Naypyidaw|Asia|Burma|Nay Pyi Taw,Yangon,Rangoon
Namibia|Windhoek|Africa
Nauru|Yaren|Oceania
Nepal|Kathmandu|Asia
Netherlands|Amsterdam|Europe|Holland
New Zealand|Wellington|Oceania
Nicaragua|Managua|North America
Niger|Niamey|Africa
Nigeria|Abuja|Africa
North Korea|Pyongyang|Asia
North Macedonia|Skopje|Europe|Macedonia
Norway|Oslo|Europe
Oman|Muscat|Asia
Pakistan|Islamabad|Asia
Palau|Ngerulmud|Oceania||Melekeok
Palestine|Ramallah|Asia|State of Palestine|East Jerusalem,Jerusalem
Panama|Panama City|North America||Ciudad de Panamá
Papua New Guinea|Port Moresby|Oceania
Paraguay|Asunción|South America||Asuncion
Peru|Lima|South America
Philippines|Manila|Asia
Poland|Warsaw|Europe||Warszawa
Portugal|Lisbon|Europe||Lisboa
Qatar|Doha|Asia
Romania|Bucharest|Europe||București
Russia|Moscow|Europe|Russian Federation|Moskva
Rwanda|Kigali|Africa
Saint Kitts and Nevis|Basseterre|North America|St Kitts and Nevis,Saint Kitts
Saint Lucia|Castries|North America|St Lucia
Saint Vincent and the Grenadines|Kingstown|North America|St Vincent and the Grenadines,St Vincent
Samoa|Apia|Oceania
San Marino|San Marino|Europe||City of San Marino
São Tomé and Príncipe|São Tomé|Africa|Sao Tome and Principe|Sao Tome
Saudi Arabia|Riyadh|Asia
Senegal|Dakar|Africa
Serbia|Belgrade|Europe||Beograd
Seychelles|Victoria|Africa
Sierra Leone|Freetown|Africa
Singapore|Singapore|Asia
Slovakia|Bratislava|Europe
Slovenia|Ljubljana|Europe
Solomon Islands|Honiara|Oceania
Somalia|Mogadishu|Africa
South Africa|Pretoria|Africa||Cape Town,Bloemfontein
South Korea|Seoul|Asia|Korea
South Sudan|Juba|Africa
Spain|Madrid|Europe
Sri Lanka|Sri Jayawardenepura Kotte|Asia||Kotte,Colombo
Sudan|Khartoum|Africa
Suriname|Paramaribo|South America
Sweden|Stockholm|Europe
Switzerland|Bern|Europe||Berne
Syria|Damascus|Asia
Tajikistan|Dushanbe|Asia
Tanzania|Dodoma|Africa||Dar es Salaam
Thailand|Bangkok|Asia
Timor-Leste|Dili|Asia|East Timor,Timor Leste
Togo|Lomé|Africa||Lome
Tonga|Nukuʻalofa|Oceania||Nuku'alofa,Nukualofa
Trinidad and Tobago|Port of Spain|North America
Tunisia|Tunis|Africa
Turkey|Ankara|Asia|Türkiye,Turkiye
Turkmenistan|Ashgabat|Asia
Tuvalu|Funafuti|Oceania
Uganda|Kampala|Africa
Ukraine|Kyiv|Europe||Kiev
United Arab Emirates|Abu Dhabi|Asia|UAE
United Kingdom|London|Europe|UK,Britain,Great Britain
United States|Washington, D.C.|North America|USA,US,United States of America,America|Washington,Washington DC
Uruguay|Montevideo|South America
Uzbekistan|Tashkent|Asia
Vanuatu|Port Vila|Oceania
Vatican City|Vatican City|Europe|Holy See,Vatican
Venezuela|Caracas|South America
Vietnam|Hanoi|Asia|Viet Nam
Yemen|Sana'a|Asia||Sanaa,Sana
Zambia|Lusaka|Africa
Zimbabwe|Harare|Africa
`.trim().split('\n');

const split = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const items = RAW.map((line) => {
  const [name, capital, continent, nameAlts, capAlts] = line.split('|');
  const it = { name, capital, continent };
  const alts = {};
  if (split(nameAlts).length) alts.name = split(nameAlts);
  if (split(capAlts).length) alts.capital = split(capAlts);
  if (Object.keys(alts).length) it.alts = alts;
  return it;
});

const deck = {
  title: 'Countries of the World',
  description: `${items.length} countries: 193 UN member states plus Vatican City and Palestine. Capitals and continents.`,
  category: ['Geography', 'Countries'],
  idField: 'name',
  modes: [
    { id: 'country-capital', label: 'Country → Capital', question: 'What is the capital of {name}?', answer: 'capital' },
    { id: 'capital-country', label: 'Capital → Country', question: '{capital} is the capital of which country?', answer: 'name' },
    { id: 'country-continent', label: 'Country → Continent', question: 'Which continent is {name} in?', answer: 'continent', mcOnly: true },
  ],
  items,
};
await mkdir('data/geography', { recursive: true });
await writeFile('data/geography/countries.json', JSON.stringify(deck, null, 2) + '\n');
console.log(`${items.length} countries`);
