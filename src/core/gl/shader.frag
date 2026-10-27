#version 300 es

precision highp float;

uniform bool u_targetIsFramebuffer;
uniform sampler2D u_source;
uniform sampler2D u_mask;
uniform vec3 u_color;
// Pigment K/S per wavelength and luminance, computed once per pass on the CPU
// (src/core/spectral.js) because the pigment is constant across the pass.
uniform float u_pigmentKS[38];
uniform float u_pigmentLuminance;

in vec2 p;

out vec4 outColor;

// SPECTRAL STARTS HERE

const int SPECTRAL_SIZE = 38;
const float SPECTRAL_GAMMA = 2.4;
const float SPECTRAL_EPSILON = 0.0001;

float spectral_uncompand(float x) {
  return (x < 0.04045) ? x / 12.92 : pow((x + 0.055) / 1.055, SPECTRAL_GAMMA);
}

float spectral_compand(float x) {
  return (x < 0.0031308) ? x * 12.92 : 1.055 * pow(x, 1.0 / SPECTRAL_GAMMA) - 0.055;
}

vec3 spectral_srgb_to_linear(vec3 srgb) {
  return vec3(spectral_uncompand(srgb[0]), spectral_uncompand(srgb[1]), spectral_uncompand(srgb[2]));
}

vec3 spectral_linear_to_srgb(vec3 lrgb) {
  return clamp(vec3(spectral_compand(lrgb[0]), spectral_compand(lrgb[1]), spectral_compand(lrgb[2])), 0., 1.);
}

void spectral_linear_to_reflectance(vec3 lrgb, inout float R[SPECTRAL_SIZE]) {
  float w = min(lrgb.r, min(lrgb.g, lrgb.b));

  lrgb -= w;

  float c = min(lrgb.g, lrgb.b);
  float m = min(lrgb.r, lrgb.b);
  float y = min(lrgb.r, lrgb.g);

  float r = min(max(0.0, lrgb.r - lrgb.b), max(0.0, lrgb.r - lrgb.g));
  float g = min(max(0.0, lrgb.g - lrgb.b), max(0.0, lrgb.g - lrgb.r));
  float b = min(max(0.0, lrgb.b - lrgb.g), max(0.0, lrgb.b - lrgb.r));
  
  R[ 0] = max(SPECTRAL_EPSILON, w * 1.0011607271876400 + c * 0.9705850013229620 + m * 0.9906735573199880 + y * 0.0210523371789306 + r * 0.0315605737777207 + g * 0.0095560747554212 + b * 0.9794047525020140);
  R[ 1] = max(SPECTRAL_EPSILON, w * 1.0011606515972800 + c * 0.9705924981434250 + m * 0.9906715249619790 + y * 0.0210564627517414 + r * 0.0315520718330149 + g * 0.0095581580120851 + b * 0.9794007068431300);
  R[ 2] = max(SPECTRAL_EPSILON, w * 1.0011603192274700 + c * 0.9706253487298910 + m * 0.9906625823534210 + y * 0.0210746178695038 + r * 0.0315148215513658 + g * 0.0095673245444588 + b * 0.9793829034702610);
  R[ 3] = max(SPECTRAL_EPSILON, w * 1.0011586727078900 + c * 0.9707868061190170 + m * 0.9906181076447950 + y * 0.0211649058448753 + r * 0.0313318044982702 + g * 0.0096129126297349 + b * 0.9792943649455940);
  R[ 4] = max(SPECTRAL_EPSILON, w * 1.0011525984455200 + c * 0.9713686732282480 + m * 0.9904514808787100 + y * 0.0215027957272504 + r * 0.0306729857725527 + g * 0.0097837090401843 + b * 0.9789630146085700);
  R[ 5] = max(SPECTRAL_EPSILON, w * 1.0011325252899800 + c * 0.9731632306212520 + m * 0.9898710814002040 + y * 0.0226738799041561 + r * 0.0286480476989607 + g * 0.0103786227058710 + b * 0.9778144666940430);
  R[ 6] = max(SPECTRAL_EPSILON, w * 1.0010850066332700 + c * 0.9767402231587650 + m * 0.9882866087596400 + y * 0.0258235649693629 + r * 0.0246450407045709 + g * 0.0120026452378567 + b * 0.9747243211338360);
  R[ 7] = max(SPECTRAL_EPSILON, w * 1.0009968788945300 + c * 0.9815876054913770 + m * 0.9842906927975040 + y * 0.0334879385639851 + r * 0.0192960753663651 + g * 0.0160977721473922 + b * 0.9671984823439730);
  R[ 8] = max(SPECTRAL_EPSILON, w * 1.0008652515227400 + c * 0.9862802656529490 + m * 0.9739349056253060 + y * 0.0519069663740307 + r * 0.0142066612220556 + g * 0.0267061902231680 + b * 0.9490796575305750);
  R[ 9] = max(SPECTRAL_EPSILON, w * 1.0006962900094000 + c * 0.9899491476891340 + m * 0.9418178384601450 + y * 0.1007490148334730 + r * 0.0102942608878609 + g * 0.0595555440185881 + b * 0.9008501289409770);
  R[10] = max(SPECTRAL_EPSILON, w * 1.0005049611488800 + c * 0.9924927015384200 + m * 0.8173903261951560 + y * 0.2391298997068470 + r * 0.0076191460521811 + g * 0.1860398265328260 + b * 0.7631504454622400);
  R[11] = max(SPECTRAL_EPSILON, w * 1.0003080818799200 + c * 0.9941456804052560 + m * 0.4324728050657290 + y * 0.5348043122727480 + r * 0.0058980410835420 + g * 0.5705798201161590 + b * 0.4659221716493190);
  R[12] = max(SPECTRAL_EPSILON, w * 1.0001196660201300 + c * 0.9951839750332120 + m * 0.1384539782588700 + y * 0.7978075786430300 + r * 0.0048233247781713 + g * 0.8614677684002920 + b * 0.2012632804510050);
  R[13] = max(SPECTRAL_EPSILON, w * 0.9999527659684070 + c * 0.9957567501108180 + m * 0.0537347216940033 + y * 0.9114498940673840 + r * 0.0042298748350633 + g * 0.9458790897676580 + b * 0.0877524413419623);
  R[14] = max(SPECTRAL_EPSILON, w * 0.9998218368992970 + c * 0.9959128182867100 + m * 0.0292174996673231 + y * 0.9537979630045070 + r * 0.0040599171299341 + g * 0.9704654864743050 + b * 0.0457176793291679);
  R[15] = max(SPECTRAL_EPSILON, w * 0.9997386095575930 + c * 0.9956061578345280 + m * 0.0213136517508590 + y * 0.9712416154654290 + r * 0.0043533695594676 + g * 0.9784136302844500 + b * 0.0284706050521843);
  R[16] = max(SPECTRAL_EPSILON, w * 0.9997095516396120 + c * 0.9945976009618540 + m * 0.0201349530181136 + y * 0.9793031238075880 + r * 0.0053434425970201 + g * 0.9795890314112240 + b * 0.0205271767569850);
  R[17] = max(SPECTRAL_EPSILON, w * 0.9997319302106270 + c * 0.9922157154923700 + m * 0.0241323096280662 + y * 0.9833801195075750 + r * 0.0076917201010463 + g * 0.9755335369086320 + b * 0.0165302792310211);
  R[18] = max(SPECTRAL_EPSILON, w * 0.9997994363461950 + c * 0.9862364527832490 + m * 0.0372236145223627 + y * 0.9854612465677550 + r * 0.0135969795736536 + g * 0.9622887553978130 + b * 0.0145135107212858);
  R[19] = max(SPECTRAL_EPSILON, w * 0.9999003303166710 + c * 0.9679433372645410 + m * 0.0760506552706601 + y * 0.9864350469766050 + r * 0.0316975442661115 + g * 0.9231215745131200 + b * 0.0136003508637687);
  R[20] = max(SPECTRAL_EPSILON, w * 1.0000204065261100 + c * 0.8912850042449430 + m * 0.2053754719423990 + y * 0.9867382506701410 + r * 0.1078611963552490 + g * 0.7934340189431110 + b * 0.0133604258769571);
  R[21] = max(SPECTRAL_EPSILON, w * 1.0001447879365800 + c * 0.5362024778620530 + m * 0.5412689034604390 + y * 0.9866178824450320 + r * 0.4638126031687040 + g * 0.4592701359024290 + b * 0.0135488943145680);
  R[22] = max(SPECTRAL_EPSILON, w * 1.0002599790341200 + c * 0.1541081190018780 + m * 0.8158416850864860 + y * 0.9862777767586430 + r * 0.8470554052720110 + g * 0.1855741036663030 + b * 0.0139594356366992);
  R[23] = max(SPECTRAL_EPSILON, w * 1.0003557969708900 + c * 0.0574575093228929 + m * 0.9128177041239760 + y * 0.9858605924440560 + r * 0.9431854093939180 + g * 0.0881774959955372 + b * 0.0144434255753570);
  R[24] = max(SPECTRAL_EPSILON, w * 1.0004275378026900 + c * 0.0315349873107007 + m * 0.9463398301669620 + y * 0.9854749276762100 + r * 0.9688621506965580 + g * 0.0543630228766700 + b * 0.0148854440621406);
  R[25] = max(SPECTRAL_EPSILON, w * 1.0004762334488800 + c * 0.0222633920086335 + m * 0.9599276963319910 + y * 0.9851769347655580 + r * 0.9780306674736030 + g * 0.0406288447060719 + b * 0.0152254296999746);
  R[26] = max(SPECTRAL_EPSILON, w * 1.0005072096750800 + c * 0.0182022841492439 + m * 0.9662605952303120 + y * 0.9849715740141810 + r * 0.9820436438543060 + g * 0.0342215204316970 + b * 0.0154592848180209);
  R[27] = max(SPECTRAL_EPSILON, w * 1.0005251915637300 + c * 0.0162990559732640 + m * 0.9693259700584240 + y * 0.9848463034157120 + r * 0.9839236237187070 + g * 0.0311185790956966 + b * 0.0156018026485961);
  R[28] = max(SPECTRAL_EPSILON, w * 1.0005350960689600 + c * 0.0153656239334613 + m * 0.9708545367213990 + y * 0.9847753518111990 + r * 0.9848454841543820 + g * 0.0295708898336134 + b * 0.0156824871281936);
  R[29] = max(SPECTRAL_EPSILON, w * 1.0005402209748200 + c * 0.0149111568733976 + m * 0.9716050665281280 + y * 0.9847380666252650 + r * 0.9852942758145960 + g * 0.0288108739348928 + b * 0.0157248764360615);
  R[30] = max(SPECTRAL_EPSILON, w * 1.0005427281678400 + c * 0.0146954339898235 + m * 0.9719627697573920 + y * 0.9847196483117650 + r * 0.9855072952198250 + g * 0.0284486271324597 + b * 0.0157458108784121);
  R[31] = max(SPECTRAL_EPSILON, w * 1.0005438956908700 + c * 0.0145964146717719 + m * 0.9721272722745090 + y * 0.9847110233919390 + r * 0.9856050715398370 + g * 0.0282820301724731 + b * 0.0157556123350225);
  R[32] = max(SPECTRAL_EPSILON, w * 1.0005444821215100 + c * 0.0145470156699655 + m * 0.9722094177458120 + y * 0.9847066833006760 + r * 0.9856538499335780 + g * 0.0281988376490237 + b * 0.0157605443964911);
  R[33] = max(SPECTRAL_EPSILON, w * 1.0005447695999200 + c * 0.0145228771899495 + m * 0.9722495776784240 + y * 0.9847045543930910 + r * 0.9856776850338830 + g * 0.0281581655342037 + b * 0.0157629637515278);
  R[34] = max(SPECTRAL_EPSILON, w * 1.0005448988776200 + c * 0.0145120341118965 + m * 0.9722676219987420 + y * 0.9847035963093700 + r * 0.9856883918061220 + g * 0.0281398910216386 + b * 0.0157640525629106);
  R[35] = max(SPECTRAL_EPSILON, w * 1.0005449625468900 + c * 0.0145066940939832 + m * 0.9722765094621500 + y * 0.9847031240775520 + r * 0.9856936646900310 + g * 0.0281308901665811 + b * 0.0157645892329510);
  R[36] = max(SPECTRAL_EPSILON, w * 1.0005449892705800 + c * 0.0145044507314479 + m * 0.9722802433068740 + y * 0.9847029256150900 + r * 0.9856958798482050 + g * 0.0281271086805816 + b * 0.0157648147772649);
  R[37] = max(SPECTRAL_EPSILON, w * 1.0005449969930000 + c * 0.0145038009464639 + m * 0.9722813248265600 + y * 0.9847028681227950 + r * 0.9856965214637620 + g * 0.0281260133612096 + b * 0.0157648801149616);
}

vec3 spectral_xyz_to_srgb(vec3 xyz) {
  mat3 XYZ_RGB;

  XYZ_RGB[0] = vec3( 3.2409699419045200, -1.537383177570090, -0.4986107602930030);
  XYZ_RGB[1] = vec3(-0.9692436362808790,  1.875967501507720,  0.0415550574071756);
  XYZ_RGB[2] = vec3( 0.0556300796969936, -0.203976958888976,  1.0569715142428700);
  
  float r = dot(XYZ_RGB[0], xyz);
  float g = dot(XYZ_RGB[1], xyz);
  float b = dot(XYZ_RGB[2], xyz);

  return spectral_linear_to_srgb(vec3(r, g, b));
}

vec3 spectral_reflectance_to_xyz(float R[SPECTRAL_SIZE]) {
  vec3 xyz = vec3(0.);
  
  xyz += R[ 0] * vec3(0.0000646919989576, 0.0000018442894440, 0.0003050171476380);
  xyz += R[ 1] * vec3(0.0002194098998132, 0.0000062053235865, 0.0010368066663574);
  xyz += R[ 2] * vec3(0.0011205743509343, 0.0000310096046799, 0.0053131363323992);
  xyz += R[ 3] * vec3(0.0037666134117111, 0.0001047483849269, 0.0179543925899536);
  xyz += R[ 4] * vec3(0.0118805536037990, 0.0003536405299538, 0.0570775815345485);
  xyz += R[ 5] * vec3(0.0232864424191771, 0.0009514714056444, 0.1136516189362870);
  xyz += R[ 6] * vec3(0.0345594181969747, 0.0022822631748318, 0.1733587261835500);
  xyz += R[ 7] * vec3(0.0372237901162006, 0.0042073290434730, 0.1962065755586570);
  xyz += R[ 8] * vec3(0.0324183761091486, 0.0066887983719014, 0.1860823707062960);
  xyz += R[ 9] * vec3(0.0212332056093810, 0.0098883960193565, 0.1399504753832070);
  xyz += R[10] * vec3(0.0104909907685421, 0.0152494514496311, 0.0891745294268649);
  xyz += R[11] * vec3(0.0032958375797931, 0.0214183109449723, 0.0478962113517075);
  xyz += R[12] * vec3(0.0005070351633801, 0.0334229301575068, 0.0281456253957952);
  xyz += R[13] * vec3(0.0009486742057141, 0.0513100134918512, 0.0161376622950514);
  xyz += R[14] * vec3(0.0062737180998318, 0.0704020839399490, 0.0077591019215214);
  xyz += R[15] * vec3(0.0168646241897775, 0.0878387072603517, 0.0042961483736618);
  xyz += R[16] * vec3(0.0286896490259810, 0.0942490536184085, 0.0020055092122156);
  xyz += R[17] * vec3(0.0426748124691731, 0.0979566702718931, 0.0008614711098802);
  xyz += R[18] * vec3(0.0562547481311377, 0.0941521856862608, 0.0003690387177652);
  xyz += R[19] * vec3(0.0694703972677158, 0.0867810237486753, 0.0001914287288574);
  xyz += R[20] * vec3(0.0830531516998291, 0.0788565338632013, 0.0001495555858975);
  xyz += R[21] * vec3(0.0861260963002257, 0.0635267026203555, 0.0000923109285104);
  xyz += R[22] * vec3(0.0904661376847769, 0.0537414167568200, 0.0000681349182337);
  xyz += R[23] * vec3(0.0850038650591277, 0.0426460643574120, 0.0000288263655696);
  xyz += R[24] * vec3(0.0709066691074488, 0.0316173492792708, 0.0000157671820553);
  xyz += R[25] * vec3(0.0506288916373645, 0.0208852059213910, 0.0000039406041027);
  xyz += R[26] * vec3(0.0354739618852640, 0.0138601101360152, 0.0000015840125870);
  xyz += R[27] * vec3(0.0214682102597065, 0.0081026402038399, 0.0000000000000000);
  xyz += R[28] * vec3(0.0125164567619117, 0.0046301022588030, 0.0000000000000000);
  xyz += R[29] * vec3(0.0068045816390165, 0.0024913800051319, 0.0000000000000000);
  xyz += R[30] * vec3(0.0034645657946526, 0.0012593033677378, 0.0000000000000000);
  xyz += R[31] * vec3(0.0014976097506959, 0.0005416465221680, 0.0000000000000000);
  xyz += R[32] * vec3(0.0007697004809280, 0.0002779528920067, 0.0000000000000000);
  xyz += R[33] * vec3(0.0004073680581315, 0.0001471080673854, 0.0000000000000000);
  xyz += R[34] * vec3(0.0001690104031614, 0.0000610327472927, 0.0000000000000000);
  xyz += R[35] * vec3(0.0000952245150365, 0.0000343873229523, 0.0000000000000000);
  xyz += R[36] * vec3(0.0000490309872958, 0.0000177059860053, 0.0000000000000000);
  xyz += R[37] * vec3(0.0000199961492222, 0.0000072209749130, 0.0000000000000000);

  return xyz;
}

float KS(float R) {
	return pow(1.0 - R, 2.0) / (2.0 * R);
}

float KM(float KS) {
  return 1.0 + KS - sqrt(pow(KS, 2.0) + 2.0 * KS);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
		
		float totalConcentration = concentration1 + concentration2;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, vec3 color2, float factor) {
	return spectral_mix(color1, 1., 1. - factor, color2, 1., factor);
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2);
}

// Same as spectral_mix(color1, u_color, factor), with the pigment's terms
// taken from uniforms instead of recomputed for every pixel. `strength`
// scales the pigment's K/S: above 1 the paint is denser than the pigment
// itself (watercolour rims and pools).
vec3 spectral_mix_pigment(vec3 color1, float factor, float strength) {
  float R1[SPECTRAL_SIZE];
  spectral_linear_to_reflectance(spectral_srgb_to_linear(color1), R1);
  float luminance1 = spectral_reflectance_to_xyz(R1)[1];

  float concentration1 = pow(1. - factor, 2.) * luminance1;
  float concentration2 = pow(factor, 2.) * u_pigmentLuminance;
  float totalConcentration = concentration1 + concentration2;

  float R[SPECTRAL_SIZE];
  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float ksMix = KS(R1[i]) * concentration1 + u_pigmentKS[i] * strength * concentration2;
    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix_pigment(vec3 color1, float factor) {
  return spectral_mix_pigment(color1, factor, 1.0);
}

#ifdef WATERCOLOR
// A watercolour paint is two pigments that separate on wet paper (src/fill/
// fill.js splits the fill colour into a warmer and a cooler one): u_pigmentKS
// and u_pigmentLuminance are pigment A, these pigment B.
uniform float u_wcPigmentB[38];
uniform float u_wcLuminanceB;

// Same as spectral_mix_pigment, with the pigment a mix of A and B in the
// ratio `ratio` (0: all A, 1: all B). K/S is linear in concentration.
vec3 spectral_mix_pigments(vec3 color1, float factor, float strength, float ratio) {
  float R1[SPECTRAL_SIZE];
  spectral_linear_to_reflectance(spectral_srgb_to_linear(color1), R1);
  float luminance1 = spectral_reflectance_to_xyz(R1)[1];

  float concentration1 = pow(1. - factor, 2.) * luminance1;
  float concentration2 = pow(factor, 2.) * mix(u_pigmentLuminance, u_wcLuminanceB, ratio);
  float totalConcentration = concentration1 + concentration2;

  float R[SPECTRAL_SIZE];
  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float pigment = mix(u_pigmentKS[i], u_wcPigmentB[i], ratio) * strength;
    R[i] = KM((KS(R1[i]) * concentration1 + pigment * concentration2) / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}
#endif

// SPECTRAL ENDS HERE

// Define constants in more compact form
const float GAMMA = 2.4, EPSILON = 0.0001;
const float DARKEN_THRESHOLD = 0.7;
const float EDGE_MIN = 0.05, EDGE_MAX = 0.35;

// Compiled three times: with BRUSH for the stroke mask, with WATERCOLOR for
// watercolour fills, and with neither for classic fills and washes. Keeping
// each variant's extra work out of the others keeps them light enough to run
// at full GPU occupancy.
#ifdef BRUSH
const bool IS_BRUSH = true;
#else
const bool IS_BRUSH = false;
#endif

// Fill mask coverage from a texel: log-domain paint (r) and erasure (g); see
// src/fill/gl_fill.js.
float fillCoverage(vec4 m) {
    return (1.0 - exp(-max(m.r, 0.0))) * exp(-m.g);
}

// Mask coverage at a point. The stroke mask stores it in alpha.
float readMask(vec2 uv) {
    vec4 m = texture(u_mask, uv);
#ifdef BRUSH
    return m.a;
#else
    return fillCoverage(m);
#endif
}

#ifdef WATERCOLOR
#pragma glslify: paperNoise = require(./value_noise.glsl)
#pragma glslify: paperHeight = require(../../stroke/paper_height.glsl)

uniform vec4 u_paper;   // contact strength, grain (logical px), density, seed
uniform vec4 u_wcShape; // centre.xy and radius (mask px), seed
uniform vec4 u_wcLook;  // rim, granulation, reticulation, drift (0..1)
uniform vec4 u_wcFlow;  // flow direction.xy (mask px, unit or 0), edge level (silhouette paint), lost edges (0..1)
// The mask blurred at half resolution (src/fill/blur.frag): r / a is the mean
// paint inside the shape nearby, a the share of the neighbourhood inside.
uniform sampler2D u_blur;
// Paper left wet by earlier fills this frame (src/fill/gl_fill.js): (wetness,
// wetness · fill index) per half-resolution pixel, and (this fill's index,
// unused, drying per fill, unused).
uniform sampler2D u_wet;
uniform vec4 u_wetInfo;
// Features placed in shape space (q: shape radii from the centre); a zero
// strength turns one off.
uniform vec4 u_wcBloom; // backrun: centre.xy, radius, strength
uniform vec4 u_wcDrop;  // wet-in-wet drop: centre.xy, radius, strength
uniform vec4 u_wcPool;  // pooled side: direction.xy, reach, strength
uniform float u_wcPigment; // fill opacity, 0..1

float fbm(vec2 q, uint seed) {
    return (0.5 * paperNoise(q, seed)
          + 0.25 * paperNoise(q * 2.03 + 17.1, seed + 1u)
          + 0.125 * paperNoise(q * 4.01 + 3.7, seed + 2u)
          + 0.0625 * paperNoise(q * 8.07 + 9.2, seed + 3u)) / 0.9375;
}

// Cell walls of a jittered grid (Worley F2 − F1): 1 on a wall, 0 at a cell
// centre. Value noise sampled at integer points is a plain hash.
float cellWalls(vec2 p, uint seed) {
    vec2 i = floor(p);
    float f1 = 9.0, f2 = 9.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 c = i + vec2(float(x), float(y));
            vec2 o = vec2(paperNoise(c, seed), paperNoise(c, seed + 1u));
            float d = length(c + 0.15 + 0.7 * o - p);
            if (d < f1) { f2 = f1; f1 = d; }
            else if (d < f2) f2 = d;
        }
    }
    return 1.0 - smoothstep(0.0, 0.35, f2 - f1);
}


// Watercolour from the paint field. The silhouette is the iso-line where the
// outline layers reach the edge level: a crisp dried edge instead of a halo,
// which trimmed and scattered layers shade but never move.
// Inside it, paint density (`body`) is the layers' own depth, modulated by:
//   rim   - pigment carried to the edge as the wash dries
//   drift - a slow tonal drift across the shape, downstream when it flows
//   pool  - pigment collected on one side, behind a soft, warped boundary
//   drop  - a wet-in-wet drop: a dense spot with a feathered, branching rim
//   bloom - a paler backrun with a fine, dark, ragged front
//   gran  - pigment settling in the paper's valleys, most where paint is thin,
//           and with reticulation, along a network of cell walls
// Returns (factor, strength, pigment ratio) for spectral_mix_pigments.
vec3 watercolor(vec2 uv, float coverage) {
    vec2 size = vec2(textureSize(u_mask, 0));
    vec2 px = uv * size;
    float density = u_paper.z;
    float level = u_wcFlow.z;
    uint seed = uint(u_wcShape.w);
    vec2 q = (px - u_wcShape.xy) / max(u_wcShape.z, 1.0);

    // The edge: an iso-line of the blurred silhouette paint, which rounds the
    // polygons' corners and steps into one smooth edge, bent by a gentle
    // wobble. `dist` is the signed distance to it in mask pixels (positive
    // inside), from the field's slope.
    vec4 blurred = texture(u_blur, uv);
    // Two scales, so the stack's evenly spaced bumps along long edges come
    // out uneven.
    float wobble = 1.0 + 0.3 * (fbm(px / (density * 7.0), seed + 29u) - 0.5)
                       + 0.45 * (fbm(q * 3.0 + 41.0, seed + 73u) - 0.5);
    float field = blurred.b - level * wobble;
    float dist = field / max(length(vec2(dFdx(field), dFdy(field))), 1e-5);

    // Lost edges: along some stretches the wash was still wet and feathered
    // out, fading from pigment to bare paper with no dried line. Where the
    // edge meets paper an earlier fill left wet, it is always lost, and the
    // pigment creeps into the wet paint in a feathered fringe.
    vec4 wetTexel = texture(u_wet, uv);
    float age = u_wetInfo.x - wetTexel.g / max(wetTexel.r, 1e-4);
    float wet = wetTexel.r > 1e-3 ? wetTexel.r * pow(u_wetInfo.z, max(age - 1.0, 0.0)) : 0.0;
    float wetEdge = smoothstep(0.1, 0.5, wet);
    float lost = max(u_wcFlow.w * smoothstep(0.45, 0.75, fbm(q * 1.8 + 23.0, seed + 67u)), wetEdge);

    // Elsewhere the wash stopped against the paper: it runs into the valleys
    // and halts at the hills, so the edge follows the same paper as the
    // granulation, rougher along some stretches. The shift is bounded to a
    // few pixels, so no flecks break off.
    float grain = density * u_paper.y;
    // The shift stays below the bumps' own size (about 8 px apart), so the
    // edge bends around them instead of breaking into specks.
    float hill = paperHeight(px / (grain * 3.0), uint(u_paper.w)) - 0.5;
    float rough = 0.4 + 0.9 * smoothstep(0.45, 0.7, fbm(q * 2.5 + 11.0, seed + 59u));
    float edgeDist = dist - hill * rough * 2.5 * density;
    float hard = clamp(edgeDist + 0.5, 0.0, 1.0);
    float soft = smoothstep(0.1 * level, 2.5 * level, blurred.b);
    // Creep: fingers of pigment of a few pixels, from the wet edge outward.
    float fingers = fbm(px / (density * 3.0), seed + 71u) - 0.5;
    float creep = smoothstep(0.05, 0.9, blurred.b / level + 0.8 * fingers);
    float inside = mix(hard, mix(soft * soft, creep, wetEdge), lost);
    if (inside <= 0.0) return vec3(0.0);

    // The rim: pigment carried to the pinned edge as the wash dried (the
    // coffee-ring effect). Concentration rises smoothly toward the edge over
    // a band 1–5% of the shape across; it is wide and strong along some
    // stretches, faint along others, heavier downstream, and gone on lost
    // edges. Only where the band is strong does it end in a crisp darker
    // pixel or two at the edge itself, and just inside the band the wash is
    // a little depleted.
    //
    // The band's profile comes from the blurred share of the neighbourhood
    // outside the shape, which rises smoothly over about 7% of the shape
    // toward the edge; a power narrows it along some stretches.
    float along = fbm(q * 2.2 + 3.0, seed + 83u);
    float downstream = dot(q / max(length(q), 1e-3), u_wcFlow.xy);
    float bandStrength = (0.3 + 0.7 * smoothstep(0.3, 0.7, along)) * max(0.0, 1.0 + 0.8 * downstream);
    float outside = clamp(2.0 * (1.0 - blurred.a), 0.0, 1.0); // 0 deep inside, 1 at the edge
    float band = pow(outside, mix(4.0, 1.2, along));
    float pinned = 1.0 - smoothstep(0.0, 1.2 * density, max(edgeDist, 0.0));
    float rim = bandStrength * (0.8 * band + 0.2 * pinned * bandStrength) * (1.0 - lost);
    float depleted = bandStrength * smoothstep(0.05, 0.25, outside) * (1.0 - smoothstep(0.3, 0.6, outside)) * (1.0 - lost);

    // Body: the blurred inside paint softens the stack's hard internal steps
    // without fading toward the edge.
    float body0 = blurred.a > 1e-3 ? 1.0 - exp(-blurred.r / blurred.a) : coverage;
    // Near the edge the raw paint thins out (the edge can sit just past it),
    // so the tone there comes from the inside mean alone: no pale fringe.
    float nearEdge = 1.0 - smoothstep(0.0, 4.0 * density, edgeDist);
    float paint = -log(max(1.0 - mix(coverage, body0, max(0.8, nearEdge)), 1e-4));
    // Every term below scales this body, so a low opacity gives a faint wash,
    // rim and all. The floor keeps thin areas from vanishing inside the edge.
    float body = 0.6 * max(paint, 0.2 * u_wcPigment);
    float thick = 1.0;

    // Drift: low-frequency variation plus a gradient along the flow.
    float drift = fbm(q * 1.1 + 5.3, seed + 7u) - 0.5;
    thick *= 1.0 + u_wcLook.w * (1.1 * drift + 0.45 * dot(q, u_wcFlow.xy));

    float pooled = 0.0;
    // Pool: pigment piles up against one side, behind a curved, warped front
    // (an arc around a point on the far side) that fades into the wash.
    if (u_wcPool.w > 0.0) {
        float reach = length(q + u_wcPool.xy * 1.2) - 1.2 - u_wcPool.z
                    + 0.3 * (fbm(q * 2.2, seed + 31u) - 0.5);
        pooled = smoothstep(-0.2, 0.15, reach);
        thick *= 1.0 + u_wcPool.w * pooled;
    }

    // Drop: a dense core whose edge breaks into branches, more so outward.
    // Its pigment sits in water, so it does not granulate.
    float drop = 0.0;
    if (u_wcDrop.w > 0.0) {
        vec2 dq = (q - u_wcDrop.xy) / u_wcDrop.z;
        float lr = length(dq);
        float branch = fbm(dq * 4.0 + 3.1, seed + 37u) - 0.5;
        float twig = fbm(dq * 13.0, seed + 39u) - 0.5;
        float d = lr + (0.3 + 0.7 * smoothstep(0.3, 1.2, lr)) * branch + 0.25 * twig * lr;
        float core = 1.0 - smoothstep(0.3, 1.0, d);
        drop = core;
        thick *= 1.0 + u_wcDrop.w * core * sqrt(core);
    }

    // Bloom: water flowing back into the drying wash from one point. The
    // inside lifts unevenly; the front is a thin, broken, cauliflower edge.
    if (u_wcBloom.w > 0.0) {
        vec2 bq = (q - u_wcBloom.xy) / u_wcBloom.z;
        float warp = fbm(bq * 1.6, seed + 11u) - 0.5;
        float lace = fbm(bq * 7.0, seed + 13u) - 0.5;
        float d = length(bq * vec2(1.0, 0.75)) + 0.9 * warp + 0.3 * lace;
        float fw = 0.03;
        float pale = (1.0 - smoothstep(0.9, 1.0, d)) * (0.55 + 0.45 * fbm(bq * 3.0, seed + 17u));
        float front = smoothstep(1.0 - fw, 1.0, d) * (1.0 - smoothstep(1.0, 1.0 + fw, d));
        front *= smoothstep(0.35, 0.6, fbm(bq * 6.0, seed + 19u));
        pale *= 1.0 - rim;
        thick *= 1.0 - 0.5 * u_wcBloom.w * pale;
        thick *= 1.0 + 0.9 * u_wcBloom.w * front;
    }

    // The rim is relative too: a pale wash has a pale ring.
    thick *= (1.0 + u_wcLook.x * 1.8 * rim) * (1.0 - 0.15 * u_wcLook.x * depleted);

    float factor = 1.0 - exp(-body * thick);

    // Granulation: paper valleys hold pigment, and flocculated clumps several
    // grains across give the mottle a second, coarser scale.
    if (u_wcLook.y > 0.0) {
        float h = paperHeight(px / (grain * 1.3), uint(u_paper.w));
        float clumps = fbm(mat2(0.8, 0.6, -0.6, 0.8) * px / (grain * 9.0), seed + 23u);
        float settle = (0.5 - h) * 0.7 + (clumps - 0.5) * 1.1;
        // Reticulation: in patches, irregular cells whose walls gather pigment.
        if (u_wcLook.z > 0.0) {
            // Strongly warped, so cells vary in size and shape, and faint.
            vec2 cq = px / (grain * 7.0);
            cq += 1.8 * vec2(fbm(cq * 0.25, seed + 43u), fbm(cq * 0.25 + 5.0, seed + 47u));
            float patches = smoothstep(0.45, 0.75, fbm(q * 2.0, seed + 53u));
            float walls = cellWalls(cq, seed + 41u) * (0.5 + fbm(cq * 0.7, seed + 79u));
            settle += 0.7 * u_wcLook.z * patches * (walls - 0.4);
        }
        thick *= max(0.0, 1.0 + u_wcLook.y * settle * (1.3 - factor) * (1.0 - 0.7 * rim) * (1.0 - drop));
        factor = 1.0 - exp(-body * thick);
    }

    // Pigment separation: the two pigments drift apart in broad zones, and
    // the one that travels further (B) gathers in the rim and pools; drops,
    // laid in later, carry the mix as it was.
    float zones = 0.75 * paperNoise(q * 1.2 + 61.0, seed + 89u)
                + 0.25 * paperNoise(q * 2.7 + 13.0, seed + 97u) - 0.5;
    float ratio = 0.5 + zones * 1.8 + 0.3 * (rim - 0.3) + 0.2 * pooled;
    ratio = clamp(mix(ratio, 0.5, drop), 0.0, 1.0);

    float strength = 1.0 + u_wcLook.x * 1.1 * rim;
    return vec3(factor * inside, strength, ratio);
}
#endif

void main(void) {
    vec2 uv = 0.5 * p + 0.5;
    vec2 sourceUV = vec2(uv.x, 1.0 - uv.y);
    vec2 maskUV = u_targetIsFramebuffer ? vec2(uv.x, 1.0 - uv.y) : uv;
    
    vec4 source = texture(u_source, sourceUV);
    float maskAlpha = readMask(maskUV);

#ifdef WATERCOLOR
    // The watercolour edge comes from smoothed coverage and can reach pixels
    // the raw paint missed, so it decides coverage itself.
    vec3 wc = watercolor(maskUV, maskAlpha);
    if (wc.x <= 0.0) {
        outColor = source;
        return;
    }
    outColor = vec4(spectral_mix_pigments(mix(vec3(1.0), source.rgb, source.a), wc.x, wc.y, wc.z), 1.);
    return;
#endif

    if (maskAlpha == 0.0) {
        outColor = source;
        return;
    }
    
    float mixIntensity = min(maskAlpha, 1.0);

    if (!IS_BRUSH) {
        vec2 texelSize = 1.0 / vec2(textureSize(u_mask, 0));
        float blurEdge = 0.0;
        for (int i = -2; i <= 2; i += 2) {
            for (int j = -2; j <= 2; j += 2) {
            vec2 neighborUV = maskUV + vec2(float(i), float(j)) * texelSize;
            float neighborAlpha = readMask(neighborUV) * 15.0;
                blurEdge += smoothstep(EDGE_MIN, EDGE_MAX, 
                          length(vec2(dFdx(neighborAlpha), dFdy(neighborAlpha))));
            }
        }
        blurEdge /= 9.0;
        mixIntensity = clamp(maskAlpha + blurEdge * 0.1, 0.0, 1.0);
    }
    
    vec3 bgColor = mix(vec3(1.0), source.rgb, source.a);

#ifdef BRUSH
    // Dense brush pixels darken the pigment itself, so they cannot use the
    // precomputed pigment terms.
    if (maskAlpha > DARKEN_THRESHOLD) {
        float blacken = 0.5 * (min(maskAlpha, 1.0) - DARKEN_THRESHOLD);
        vec3 pigment = max(u_color * (1.0 - blacken) - vec3(0.5) * blacken, vec3(0.0));
        outColor = vec4(spectral_mix(bgColor, pigment, mixIntensity), 1.);
        return;
    }
#endif
    outColor = vec4(spectral_mix_pigment(bgColor, mixIntensity), 1.);
}