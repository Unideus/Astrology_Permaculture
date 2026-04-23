const fs = require('fs');
const SunCalc = require('suncalc');
const { DateTime } = require('luxon');

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    if (key && value) acc[key.replace('--', '')] = value;
    return acc;
}, {});

const lat = parseFloat(args.lat);
const lon = parseFloat(args.lon);
const blood = (args.blood || '').toUpperCase();

function getSunSign(date) {
    const d = DateTime.fromJSDate(date);
    const m = d.month, day = d.day;
    if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'Aries';
    if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'Taurus';
    if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'Gemini';
    if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'Cancer';
    if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'Leo';
    if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'Virgo';
    if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'Libra';
    if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'Scorpio';
    if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'Sagittarius';
    if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'Capricorn';
    if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'Aquarius';
    return 'Pisces';
}

const dobDate = DateTime.fromISO(args.dob).toJSDate();
const sunSign = getSunSign(dobDate);
const data = JSON.parse(fs.readFileSync('biodynamic_map.json', 'utf-8'));
const mineral = data.zodiac_minerals[sunSign];
const bloodProfile = data.blood_type_focus[blood];

// --- MOON LOGIC ---
const moon = SunCalc.getMoonIllumination(new Date());
// 0 is New Moon, 0.5 is Full Moon. Logic: <0.5 is Waxing, >0.5 is Waning.
const isWaxing = moon.phase < 0.5;
const moonAction = isWaxing ? "Waxing (Sap Rising): Focus on Leafy/Above-ground crops." : "Waning (Sap Falling): Focus on Root crops and Pruning.";

const times = SunCalc.getTimes(new Date(), lat, lon);
const pos = SunCalc.getPosition(times.noon || new Date(), lat, lon);
const altitude = pos.altitude * 180 / Math.PI;

const plan = `
# Biodynamic Plan for ${bloodProfile.profile} (${sunSign})
**Solar Alt:** ${altitude.toFixed(2)}° | **Moon Phase:** ${(moon.fraction * 100).toFixed(1)}% Illuminated
**Current Lunar Action:** ${moonAction}

## Personalized Implementation:
* **Mineral Profile:** ${mineral}
* **Planting Focus:** ${bloodProfile.focus}
* **Constraint:** Avoid ${bloodProfile.avoid}
`;

fs.writeFileSync('implementation_plan.md', plan);
console.log('Success! Full Biodynamic Plan generated.');
