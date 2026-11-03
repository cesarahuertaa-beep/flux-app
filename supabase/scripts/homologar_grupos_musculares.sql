-- Homologar grupos musculares en biblioteca_ejercicios al catalogo unico estandar (19 grupos)
UPDATE biblioteca_ejercicios SET grupo_muscular = 'pecho' WHERE LOWER(grupo_muscular) = 'pecho';
UPDATE biblioteca_ejercicios SET grupo_muscular = 'dorsal' WHERE LOWER(grupo_muscular) IN ('dorsal', 'espalda');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'deltoide_anterior' WHERE LOWER(grupo_muscular) IN ('deltoide_anterior', 'deltoide anterior', 'hombro', 'hombros');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'deltoide_posterior' WHERE LOWER(grupo_muscular) IN ('deltoide_posterior', 'deltoide posterior', 'hombro posterior');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'biceps' WHERE LOWER(grupo_muscular) IN ('biceps', 'bíceps');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'triceps' WHERE LOWER(grupo_muscular) IN ('triceps', 'tríceps');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'cuadriceps' WHERE LOWER(grupo_muscular) IN ('cuadriceps', 'cuádriceps');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'gluteo' WHERE LOWER(grupo_muscular) IN ('gluteo', 'glúteo');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'pantorrilla' WHERE LOWER(grupo_muscular) IN ('pantorrilla', 'gemelos');
UPDATE biblioteca_ejercicios SET grupo_muscular = 'soleo' WHERE LOWER(grupo_muscular) IN ('soleo', 'sóleo');
