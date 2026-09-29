-- Catálogo inicial. price_cents = NULL: defina os preços no /admin antes de abrir a loja.
-- Rodar de novo substitui os dados dessas peças (INSERT OR REPLACE).

INSERT OR REPLACE INTO products (id, name, category, description, details, images, price_cents, stock, featured, active, sort) VALUES
('margarida-cru', 'Bolsa Margarida Cru', 'Bolsas',
 'Tiracolo em fio cru com aba arredondada e uma margarida de madeira aplicada à mão. Leve, clara e fácil de combinar.',
 '["Alça trançada longa, para usar transversal","Argolas de madeira","Aba com flor de madeira aplicada","Etiqueta Ponto Sem Nó em couro"]',
 '["bolsa-margarida-cru.jpg"]', NULL, 1, 1, 1, 10),

('bolsa-argila', 'Bolsa Argila', 'Bolsas',
 'Bolsa em terracota com ponto em relevo que lembra trança. Estrutura firme e cor quente, a cara da marca.',
 '["Ponto em relevo trançado","Argolas de metal envelhecido","Alça de ombro em crochet","Etiqueta Ponto Sem Nó em couro"]',
 '["bolsa-argila.jpg"]', NULL, 1, 1, 1, 20),

('top-lavanda', 'Top Lavanda', 'Tops',
 'Top frente única em lavanda com argola central forrada em crochet e franjas longas que acompanham o movimento.',
 '["Frente única com amarração no pescoço","Argola central forrada em crochet","Franjas longas"]',
 '["top-lavanda.jpg"]', NULL, 1, 1, 1, 30),

('margarida-noir', 'Bolsa Margarida Noir', 'Bolsas',
 'A versão em preto da Margarida, com flor em dois tons de madeira sobre a aba. Elegante do dia à noite.',
 '["Textura em relevo","Alça trançada longa","Argolas de madeira","Flor de madeira em dois tons"]',
 '["bolsa-margarida-noir.jpg"]', NULL, 1, 0, 1, 40),

('bolsa-telha', 'Bolsa Telha', 'Bolsas',
 'Bolsa de ombro em terracota com alça larga e forro floral por dentro. Uma surpresa delicada a cada vez que abre.',
 '["Forro de tecido floral","Fechamento com zíper","Alça larga em crochet","Argolas de metal envelhecido"]',
 '["bolsa-argila-aberta.jpg"]', NULL, 1, 0, 1, 50),

('bolsa-noite', 'Bolsa Noite', 'Bolsas',
 'Bolsinha preta com fecho de beijinho em metal envelhecido. Tem alça de mão em crochet e corrente para usar no ombro.',
 '["Fecho de beijinho em metal","Alça de mão em crochet","Corrente para usar no ombro","Textura em relevo"]',
 '["bolsa-vintage-noite.jpg"]', NULL, 1, 0, 1, 60),

('bolsa-grafite', 'Bolsa Grafite', 'Bolsas',
 'Bolsa de ombro em grafite com linhas limpas e argola de madeira. Uma peça versátil para o dia a dia.',
 '["Argola de madeira","Forro com zíper","Alça de ombro em crochet"]',
 '["bolsa-grafite-ombro.jpg"]', NULL, 1, 0, 1, 70),

('tiracolo-grafite', 'Tiracolo Grafite', 'Bolsas',
 'Tiracolo em fio de malha grafite com um ponto de cor: a argola vermelha que prende a alça.',
 '["Fio de malha","Alça longa, para usar transversal","Argola vermelha","Etiqueta Ponto Sem Nó em couro"]',
 '["bolsa-grafite-tiracolo.jpg"]', NULL, 1, 0, 1, 80),

('top-mar', 'Top Mar', 'Tops',
 'Top frente única em fio com brilho verde-água, decote em V e paetês coloridos costurados um a um. Feito para festa.',
 '["Fio com brilho","Decote em V com amarração","Paetês aplicados à mão"]',
 '["top-mar.jpg"]', NULL, 1, 0, 1, 90);
