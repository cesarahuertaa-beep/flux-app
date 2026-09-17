export const calculateBodyComposition = (data, sexo, edad) => {
  const result = {};
  
  const peso = parseFloat(data.peso) || 0;
  const estaturaCm = parseFloat(data.estatura) || 0;
  const estaturaM = estaturaCm / 100;
  const edadNum = parseFloat(edad) || 25;
  
  if (peso && estaturaM) {
    result.imc = peso / (estaturaM * estaturaM);
  }
  
  if (data.cintura && data.cadera) {
    result.icc = parseFloat(data.cintura) / parseFloat(data.cadera);
  }

  // --- Jackson-Pollock 3 Sites & Siri ---
  // Hombres: Pecho, Abdomen, Muslo
  // Mujeres: Tríceps, Suprailíaco, Muslo
  let sumFolds = 0;
  let bodyDensity = 0;
  
  const triceps = parseFloat(data.pliegue_triceps) || 0;
  const supra = parseFloat(data.pliegue_suprailiaco) || 0;
  const muslo = parseFloat(data.pliegue_muslo) || 0;
  const pecho = parseFloat(data.pliegue_pectoral) || 0;
  const abdomen = parseFloat(data.pliegue_abdominal) || 0;
  
  if (sexo === 'M') {
    if (pecho && abdomen && muslo) {
      sumFolds = pecho + abdomen + muslo;
      bodyDensity = 1.10938 - (0.0008267 * sumFolds) + (0.0000016 * sumFolds * sumFolds) - (0.0002574 * edadNum);
    }
  } else {
    if (triceps && supra && muslo) {
      sumFolds = triceps + supra + muslo;
      bodyDensity = 1.0994921 - (0.0009929 * sumFolds) + (0.0000023 * sumFolds * sumFolds) - (0.0001392 * edadNum);
    }
  }
  
  if (bodyDensity > 0) {
    const grasaPct = (495 / bodyDensity) - 450;
    result.grasa_pct = grasaPct;
    result.calc_masa_grasa = peso * (grasaPct / 100);
  }

  // --- Rocha Bone Mass ---
  const dMuneca = parseFloat(data.diametro_muneca) || 0; // cm
  const dRodilla = parseFloat(data.diametro_rodilla) || 0; // cm
  
  if (estaturaM > 0 && dMuneca > 0 && dRodilla > 0) {
    // Rocha (1975): Masa Ósea (kg) = 3.02 * (Talla^2 * D_biestiloideo * D_bicondileo_femoral * 400)^0.712
    // Inputs MUST be in meters
    const dMunecaM = dMuneca / 100;
    const dRodillaM = dRodilla / 100;
    result.calc_masa_osea = 3.02 * Math.pow(Math.pow(estaturaM, 2) * dMunecaM * dRodillaM * 400, 0.712);
  }

  // --- Matiegka Muscle Mass (Modified for available limbs: Arm, Thigh, Calf) ---
  const brazoRel = parseFloat(data.brazo_relajado) || 0; // cm
  const pantorrilla = parseFloat(data.pantorrilla) || 0; // cm
  const pantorrillaFold = parseFloat(data.pliegue_pantorrilla) || 0; // mm

  if (estaturaCm > 0 && brazoRel > 0 && muslo > 0 && pantorrilla > 0 && triceps > 0 && pantorrillaFold > 0) {
    // r = C / (2*PI) - S / 2  (S in cm)
    const r1 = (brazoRel / (2 * Math.PI)) - (triceps / 10 / 2);
    // Approximation for thigh circumference skinfold (we'll use anterior thigh fold)
    const r3 = (parseFloat(data.muslo) / (2 * Math.PI)) - (muslo / 10 / 2);
    const r4 = (pantorrilla / (2 * Math.PI)) - (pantorrillaFold / 10 / 2);
    
    // Average radius using the 3 available limbs (instead of 4)
    const R = (r1 + r3 + r4) / 3;
    result.calc_masa_muscular = Math.pow(R, 2) * estaturaCm * 0.0065;
  }

  // --- Wurch Residual Mass (by Subtraction to ensure 100% sum) ---
  if (result.calc_masa_grasa && result.calc_masa_muscular && result.calc_masa_osea) {
    result.calc_masa_residual = peso - (result.calc_masa_grasa + result.calc_masa_muscular + result.calc_masa_osea);
  }

  // --- Heath-Carter Somatotype ---
  const subescapular = parseFloat(data.pliegue_subescapular) || 0;
  const dCodo = parseFloat(data.diametro_codo) || 0;
  const brazoCont = parseFloat(data.brazo_contraido) || 0;

  if (peso && estaturaCm && triceps && subescapular && supra && pantorrillaFold && dCodo && dRodilla && brazoCont && pantorrilla) {
    // Endomorphy
    const sumFoldsEndo = triceps + subescapular + supra;
    const X = sumFoldsEndo * (170.18 / estaturaCm);
    const endo = -0.7182 + (0.1451 * X) - (0.00068 * Math.pow(X, 2)) + (0.0000014 * Math.pow(X, 3));
    
    // Mesomorphy
    const CAG = brazoCont - (triceps / 10);
    const CCG = pantorrilla - (pantorrillaFold / 10);
    const meso = (0.858 * dCodo) + (0.601 * dRodilla) + (0.188 * CAG) + (0.161 * CCG) - (0.131 * estaturaCm) + 4.5;
    
    // Ectomorphy
    const HWR = estaturaCm / Math.pow(peso, 1/3);
    let ecto = 0.1;
    if (HWR >= 40.75) ecto = (0.732 * HWR) - 28.58;
    else if (HWR >= 38.25) ecto = (0.463 * HWR) - 17.63;
    
    // Convert to X, Y coordinates
    // X = Ectomorphy - Endomorphy
    // Y = 2 * Mesomorphy - (Endomorphy + Ectomorphy)
    result.somatotipo_x = ecto - endo;
    result.somatotipo_y = (2 * meso) - (endo + ecto);
  }

  // Round all numeric values to 2 decimals
  Object.keys(result).forEach(k => {
    if (typeof result[k] === 'number') {
      result[k] = Math.round(result[k] * 100) / 100;
    }
  });

  return result;
};
