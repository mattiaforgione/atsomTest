const stavStops = [
    {
        "id": "stop_abb_vv",
        "name": "Abbiategrasso - P.za Vittorio Veneto",
        "operatore": "STAV",
        "lat": 45.400911,
        "lng": 8.913239
    },
    {
        "id": "stop_abb_osp/uomo",
        "name": "Abbiategrasso - Ospedale/Dell'Uomo",
        "operatore": "STAV",
        "lat": 45.395653,
        "lng": 8.914475
    },
    {
        "id": "stop_abb_osp/cattaneo",
        "name": "Abbiategrasso - Ospedale/Cattaneo",
        "operatore": "STAV",
        "lat": 45.395288,
        "lng": 8.915165
    },
    {
        "id": "stop_abb_einstein",
        "name": "Abbiategrasso - Via Einstein",
        "operatore": "STAV",
        "lat": 45.394267,
        "lng": 8.909060
    },
    {
        "id": "stop_abb_stignani",
        "name": "Abbiategrasso - Via Stignani",
        "operatore": "STAV",
        "lat": 45.392028,
        "lng": 8.906648
    },
    {
        "id": "stop_abb_cattaneo/pavia",
        "name": "Abbiategrasso - Via Cattaneo/Pavia",
        "operatore": "STAV",
        "lat": 45.395651,
        "lng": 8.917575
    },
    {
        "id": "stop_abb_cattaneo/cairoli",
        "name": "Abbiategrasso - Via Cattaneo/Cairoli",
        "operatore": "STAV",
        "lat": 45.395782,
        "lng": 8.918331
    },
    {
        "id": "stop_abb_fs",
        "name": "Abbiategrasso - Stazione FS",
        "operatore": "STAV",
        "lat": 45.397611,
        "lng": 8.920136,
        "connections": [
            { "name": "R31", "color": "#0462AC", "txColor": "#ffffff", "icon": "img/RegioLogo.png" },
        ]
    },
    {
        "id": "stop_abb_mazzini21",
        "name": "Abbiategrasso - V.le Mazzini 21",
        "operatore": "STAV",
        "lat": 45.398802,
        "lng": 8.921718
    },
    {
        "id": "stop_abb_mazzini/aprile",
        "name": "Abbiategrasso - V.le Mazzini/XXV Aprile",
        "operatore": "STAV",
        "lat": 45.398858,
        "lng": 8.923639
    },
    {
        "id": "stop_abb_mazzini/libia",
        "name": "Abbiategrasso - V.le Mazzini/Libia",
        "operatore": "STAV",
        "lat": 45.399218,
        "lng": 8.928148
    },
    {
        "id": "stop_abb_mazzini/libia2",
        "name": "Abbiategrasso - V.le Mazzini/Libia",
        "operatore": "STAV",
        "lat": 45.399236,
        "lng": 8.927486
    },
    {
        "id": "stop_abb_castelletto",
        "name": "Abbiategrasso - Castelletto",
        "operatore": "STAV",
        "lat": 45.399561,
        "lng": 8.933115
    },
    {
        "id": "stop_abb_castelletto2",
        "name": "Abbiategrasso - Castelletto",
        "operatore": "STAV",
        "lat": 45.399706,
        "lng": 8.933548
    },
    {
        "id": "stop_alb_fs",
        "name": "Albairate/Vermezzo FS",
        "operatore": "STAV",
        "lat": 45.404184,
        "lng": 8.958023,
        "connections": [
            { "name": "R31", "color": "#0462AC", "txColor": "#ffffff", "icon": "img/RegioLogo.png" },
            { "name": "S9", "color": "#A4328A", "txColor": "#ffffff", "icon": "img/S9Logo.png" },
            { "name": "S19", "color": "#67032F", "txColor": "#ffffff", "icon": "img/S19Logo.png" }
        ]
    },
    {
        "id": "stop_gud_sp30",
        "name": "Gudo Visconti - SP30",
        "operatore": "STAV",
        "lat": 45.371138,
        "lng": 8.99577
    },
    {
        "id": "stop_gud_corn",
        "name": "Gudo Visconti - Via Cornaggia",
        "operatore": "STAV",
        "lat": 45.3735,
        "lng": 8.997646
    },
    {
        "id": "stop_ros_dante",
        "name": "Rosate - Via Dante",
        "lat": 45.348984,
        "lng": 9.013571,
        "connections": [
            { "name": "Z516", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/StarLogo.png" },
        ]
    },
    {
        "id": "stop_ros_circon/maggio",
        "name": "Rosate - Via Circonvallazione/I Maggio",
        "operatore": "STAV",
        "lat": 45.352657,
        "lng": 9.016691
    },
    {
        "id": "stop_ros_circon/maggio2",
        "name": "Rosate - Via Circonvallazione/I Maggio",
        "operatore": "STAV",
        "lat": 45.352402,
        "lng": 9.015978
    },
    {
        "id": "stop_ros_europa",
        "name": "Rosate - V.le Europa",
        "operatore": "STAV",
        "lat": 45.353326,
        "lng": 9.021320
    },
    {
        "id": "stop_ros_europa2",
        "name": "Rosate - V.le Europa",
        "operatore": "STAV",
        "lat": 45.353426,
        "lng": 9.022588
    },
    {
        "id": "stop_ros_industria",
        "name": "Rosate - Via Industria",
        "operatore": "STAV",
        "lat": 45.342214,
        "lng": 9.016637,
    },
    {
        "id": "stop_ros_industria2",
        "name": "Rosate - Via Industria",
        "operatore": "STAV",
        "lat": 45.340560,
        "lng": 9.017431,
    },
    {
        "id": "stop_ros_pellico",
        "name": "Rosate - Via Pellico",
        "operatore": "STAV",
        "lat": 45.352384,
        "lng": 9.014781,
    },
    {
        "id": "stop_bub_europa",
        "name": "Bubbiano - Via Europa",
        "lat": 45.328319,
        "lng": 9.016735,
    },
    {
        "id": "stop_cal_bettola",
        "name": "Calvignasco - Bettola",
        "lat": 45.331535,
        "lng": 9.019678,
    },
    {
        "id": "stop_cal_bettola2",
        "name": "Calvignasco - Bettola",
        "lat": 45.332352,
        "lng": 9.020164,
    },
    {
        "id": "stop_zelo_sp30",
        "name": "Zelo Surrigone - SP30",
        "operatore": "STAV",
        "lat": 45.385671,
        "lng": 8.982221
    },
    {
        "id": "stop_zelo_roma",
        "name": "Zelo Surrigone - P.za Roma",
        "operatore": "STAV",
        "lat": 45.388294,
        "lng": 8.985440
    },
    {
        "id": "stop_zelo_manzoni",
        "name": "Zelo Surrigone - Via Manzoni",
        "operatore": "STAV",
        "lat": 45.391235,
        "lng": 8.983467
    },
    {
        "id": "stop_zelo_manzoni2",
        "name": "Zelo Surrigone - Via Manzoni",
        "operatore": "STAV",
        "lat": 45.391003,
        "lng": 8.983743
    },
    {
        "id": "stop_verm_sp30",
        "name": "Vermezzo - SP30/Via Roma",
        "operatore": "STAV",
        "lat": 45.392439,
        "lng": 8.977617
    },
    {
        "id": "stop_verm_cim",
        "name": "Vermezzo - Cimitero",
        "operatore": "STAV",
        "lat": 45.396541,
        "lng": 8.975189
    },
    {
        "id": "stop_verm_comunale",
        "name": "Vermezzo - P.za Comunale",
        "operatore": "STAV",
        "lat": 45.394544,
        "lng": 8.980817
    },
    {
        "id": "stop_verm_nav",
        "name": "Vermezzo - Naviglio",
        "operatore": "STAV",
        "lat": 45.402706,
        "lng": 8.973638
    },
    {
        "id": "stop_gagg_bett",
        "name": "Gaggiano - C.na Barbattola",
        "operatore": "STAV",
        "lat": 45.403381,
        "lng": 8.984171
    },
    {
        "id": "stop_gagg_rosa",
        "name": "Gaggiano - La Rosa",
        "operatore": "STAV",
        "lat": 45.404423,
        "lng": 9.001202
    },
    {
        "id": "stop_gagg_rosa2",
        "name": "Gaggiano - La Rosa",
        "operatore": "STAV",
        "lat": 45.404461,
        "lng": 9.000867
    },
    {
        "id": "stop_gagg_bett2",
        "name": "Gaggiano - La Bettolina",
        "operatore": "STAV",
        "lat": 45.405114,
        "lng": 9.011338
    },
    {
        "id": "stop_gagg_fs",
        "name": "Gaggiano - Stazione FS",
        "operatore": "STAV",
        "lat": 45.409384,
        "lng": 9.031786,
        "connections": [
            { "name": "S9", "color": "#A4328A", "txColor": "#ffffff", "icon": "img/S9Logo.png" },
            { "name": "S19", "color": "#67032F", "txColor": "#ffffff", "icon": "img/S19Logo.png" }
        ]
    },
    {
        "id": "stop_gagg_gasp",
        "name": "Gaggiano - Via De Gasperi",
        "operatore": "STAV",
        "lat": 45.407751,
        "lng": 9.04406
    },
    {
        "id": "stop_gagg_polo/vinci",
        "name": "Gaggiano - Via M. Polo/Da Vinci",
        "operatore": "STAV",
        "lat": 45.409649,
        "lng": 9.043807
    },
    {
        "id": "stop_gagg_polo/vinci2",
        "name": "Gaggiano - Via M. Polo/Da Vinci",
        "operatore": "STAV",
        "lat": 45.410076,
        "lng": 9.045447
    },
    {
        "id": "stop_gagg_polo/corn",
        "name": "Gaggiano - Via M. Polo/Al Cornicione",
        "operatore": "STAV",
        "lat": 45.408481,
        "lng": 9.040012
    },
    {
        "id": "stop_gagg_polo/corn2",
        "name": "Gaggiano - Via M. Polo/Al Cornicione",
        "operatore": "STAV",
        "lat": 45.408236,
        "lng": 9.039488
    },
    {
        "id": "stop_gagg_roma",
        "name": "Gaggiano - Via Roma",
        "operatore": "STAV",
        "lat": 45.406447,
        "lng": 9.034104
    },
    {
        "id": "stop_gagg_gramsci",
        "name": "Gaggiano - Via Gramsci",
        "operatore": "STAV",
        "lat": 45.405319,
        "lng": 9.03361
    },
    {
        "id": "stop_gagg_corn",
        "name": "Gaggiano - Via Al Cornicione",
        "operatore": "STAV",
        "lat": 45.404687,
        "lng": 9.038558
    },
    {
        "id": "stop_gagg_corn/roma",
        "name": "Gaggiano - Via Al Cornicione/Roma",
        "operatore": "STAV",
        "lat": 45.407721,
        "lng": 9.0391
    },
    {
        "id": "stop_gagg_bon",
        "name": "Gaggiano - Bonirola",
        "operatore": "STAV",
        "lat": 45.412512,
        "lng": 9.053236
    },
    {
        "id": "stop_gagg_bon2",
        "name": "Gaggiano - Bonirola",
        "operatore": "STAV",
        "lat": 45.4126728,
        "lng": 9.0534391
    },
    {
        "id": "stop_gagg_cim",
        "name": "Gaggiano - Cimitero",
        "operatore": "STAV",
        "lat": 45.3963679,
        "lng": 9.0301294
    },
    {
        "id": "stop_vig",
        "name": "Vigano",
        "operatore": "STAV",
        "lat": 45.379977,
        "lng": 9.0282039
    },
    {
        "id": "stop_vig2",
        "name": "Vigano",
        "operatore": "STAV",
        "lat": 45.3796602,
        "lng": 9.0284486
    },
    {
        "id": "stop_vito",
        "name": "San Vito",
        "operatore": "STAV",
        "lat": 45.419784,
        "lng": 9.015116
    },
    {
        "id": "stop_trez_zano",
        "name": "Trezzano sul Naviglio - Stab. Zanoletti",
        "lat": 45.413722,
        "lng": 9.03974,
        "operatore": "STAV",
        "connections": [
            { "name": "327", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_trez_vinci/kennedy",
        "name": "Trezzano sul Naviglio - Via Da Vinci/Kennedy",
        "lat": 45.415959,
        "lng": 9.045596
    },
    {
        "id": "stop_trez_vinci/pergolesi",
        "name": "Trezzano sul Naviglio - Via Da Vinci/Pergolesi",
        "lat": 45.418491,
        "lng": 9.052169
    },
    {
        "id": "stop_trez_vinci/centro",
        "name": "Trezzano sul Naviglio - Via Da Vinci/Centro",
        "lat": 45.420398,
        "lng": 9.057053
    },
    {
        "id": "stop_trez_vinci/poste",
        "name": "Trezzano sul Naviglio - Via Da Vinci/Poste",
        "lat": 45.422176,
        "lng": 9.061668
    },
    {
        "id": "stop_trez_colombo/curiel",
        "name": "Trezzano sul Naviglio - V.le Colombo/Curiel",
        "lat": 45.423306,
        "lng": 9.064664,
        "connections": [
            { "name": "327", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_trez_colombo/curiel2",
        "name": "Trezzano sul Naviglio - V.le Colombo/Curiel",
        "lat": 45.424131,
        "lng": 9.065638
    },
    {
        "id": "stop_trez_colombo/moro",
        "name": "Trezzano sul Naviglio - V.le Colombo/Moro",
        "lat": 45.42502,
        "lng": 9.069172
    },
    {
        "id": "stop_trez_colombo/moro2",
        "name": "Trezzano sul Naviglio - V.le Colombo/Moro",
        "lat": 45.425196,
        "lng": 9.068449
    },
    {
        "id": "stop_trez_colombo/cellini",
        "name": "Trezzano sul Naviglio - V.le Colombo/Cellini",
        "lat": 45.426336,
        "lng": 9.072598
    },
    {
        "id": "stop_trez_colombo/cellini2",
        "name": "Trezzano sul Naviglio - V.le Colombo/Cellini",
        "lat": 45.426561,
        "lng": 9.071974
    },
    {
        "id": "stop_trez_circon",
        "name": "Trezzano sul Naviglio - Circonvallazione",
        "operatore": "STAV",
        "lat": 45.41792,
        "lng": 9.072443
    },
    {
        "id": "stop_trez_circon2",
        "name": "Trezzano sul Naviglio - Circonvallazione",
        "operatore": "STAV",
        "lat": 45.417503,
        "lng": 9.070947
    },
    {
        "id": "stop_trez_milano",
        "name": "Trezzano sul Naviglio - Via Milano",
        "operatore": "STAV",
        "lat": 45.420192,
        "lng": 9.074806
    },
    {
        "id": "stop_trez_milano2",
        "name": "Trezzano sul Naviglio - Via Milano",
        "operatore": "STAV",
        "lat": 45.420793,
        "lng": 9.075671
    },

    // fermate linee trezzano

    {
        "id": "stop_trez_fs",
        "name": "Trezzano sul Naviglio - Stazione FS",
        "operatore": "STAV",
        "lat": 45.420797,
        "lng": 9.067003,
        "connections": [
            { "name": "S9", "color": "#A4328A", "txColor": "#ffffff", "icon": "img/S9Logo.png" },
            { "name": "S19", "color": "#67032F", "txColor": "#ffffff", "icon": "img/S19Logo.png" }
        ]
    },
    {
        "id": "stop_trez_concordia",
        "name": "Trezzano sul Naviglio - Via Concordia/Scuola",
        "operatore": "STAV",
        "lat": 45.422926,
        "lng": 9.068918
    },
    {
        "id": "stop_trez_treves/angelo",
        "name": "Trezzano sul Naviglio - Via Treves/S. Angelo",
        "operatore": "STAV",
        "lat": 45.419341,
        "lng": 9.068462
    },
    {
        "id": "stop_trez_treves/volontari",
        "name": "Trezzano sul Naviglio - Via Treves/Volontari S.",
        "operatore": "STAV",
        "lat": 45.417517,
        "lng": 9.063785
    },
    {
        "id": "stop_trez_treves/angelo3",
        "name": "Trezzano sul Naviglio - Via Treves/S. Angelo 3",
        "operatore": "STAV",
        "lat": 45.419324,
        "lng": 9.068608
    },
    {
        "id": "stop_trez_indipendenza",
        "name": "Trezzano sul Naviglio - Via Indipendenza",
        "operatore": "STAV",
        "lat": 45.418668,
        "lng": 9.070352
    },
    {
        "id": "stop_trez_cristoforo/giacosa",
        "name": "Trezzano sul Naviglio - Via S. Cristoforo/Giacosa",
        "operatore": "STAV",
        "lat": 45.419759,
        "lng": 9.076137
    },
    {
        "id": "stop_trez_matteotti",
        "name": "Trezzano sul Naviglio - Via Matteotti",
        "operatore": "STAV",
        "lat": 45.418452,
        "lng": 9.074476
    },
    {
        "id": "stop_trez_virgilio",
        "name": "Trezzano sul Naviglio - Via Virgilio",
        "operatore": "STAV",
        "lat": 45.416135,
        "lng": 9.074511
    },
    {
        "id": "stop_trez_costa",
        "name": "Trezzano sul Naviglio - Via Costa",
        "operatore": "STAV",
        "lat": 45.417834,
        "lng": 9.076334
    },
    {
        "id": "stop_trez_francesco",
        "name": "Trezzano sul Naviglio - Via S. Francesco",
        "operatore": "STAV",
        "lat": 45.416061,
        "lng": 9.079468
    },
    {
        "id": "stop_trez_marchesina56",
        "name": "Trezzano sul Naviglio - Via Marchesina 56",
        "operatore": "STAV",
        "lat": 45.414501,
        "lng": 9.079451
    },
    {
        "id": "stop_trez_salvini1",
        "name": "Trezzano sul Naviglio - Via Salvini 1",
        "operatore": "STAV",
        "lat": 45.414435,
        "lng": 9.076862
    },
    {
        "id": "stop_trez_salvini2",
        "name": "Trezzano sul Naviglio - Via Salvini 2",
        "operatore": "STAV",
        "lat": 45.414509,
        "lng": 9.074296
    },
    {
        "id": "stop_trez_salerno",
        "name": "Trezzano sul Naviglio - Via Salerno",
        "operatore": "STAV",
        "lat": 45.414801,
        "lng": 9.071410
    },
    {
        "id": "stop_trez_croce",
        "name": "Trezzano sul Naviglio - Via B. Croce",
        "operatore": "STAV",
        "lat": 45.420077,
        "lng": 9.070839
    },
    {
        "id": "stop_trez_ticino",
        "name": "Trezzano sul Naviglio - Via Ticino",
        "operatore": "STAV",
        "lat": 45.421790,
        "lng": 9.072115
    },


    // fermate linee normali

    {
        "id": "stop_ces_vig/gramsci",
        "name": "Cesano Boscone - Nuova Vigevanese/Gramsci",
        "lat": 45.431324,
        "lng": 9.085253
    },
    {
        "id": "stop_ces_vig/gramsci2",
        "name": "Cesano Boscone - Nuova Vigevanese/Gramsci",
        "lat": 45.431467,
        "lng": 9.085242
    },
    {
        "id": "stop_cors_italia",
        "name": "Corsico - Viale Italia",
        "lat": 45.435976,
        "lng": 9.098308,
        "connections": [
            { "name": "327 - 326 - 321 e 322 solo corse scolastiche", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_cors_italia2",
        "name": "Corsico - Viale Italia",
        "lat": 45.436681,
        "lng": 9.100056,
        "connections": [
            { "name": "327 - 326 - 321 e 322 solo corse scolastiche", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_cors_ces",
        "name": "Corsico - Via Cesano",
        "lat": 45.43709,
        "lng": 9.101936
    },
    {
        "id": "stop_cors_vig/liberazione",
        "name": "Corsico - Nuova Vigevanese/Liberazione",
        "lat": 45.438138,
        "lng": 9.105446
    },
    {
        "id": "stop_cors_vig/liberazione2",
        "name": "Corsico - Nuova Vigevanese/Liberazione",
        "lat": 45.438214,
        "lng": 9.105146
    },
    {
        "id": "stop_cors_17",
        "name": "Corsico - Nuova Vigevanese 17",
        "lat": 45.442023,
        "lng": 9.113221
    },
    {
        "id": "stop_cors_172",
        "name": "Corsico - Nuova Vigevanese 17",
        "lat": 45.442671,
        "lng": 9.114026
    },
    {
        "id": "stop_cors_guardia",
        "name": "Corsico - C.na Guardia",
        "operatore": "STAV",
        "lat": 45.426055,
        "lng": 9.089165
    },
    {
        "id": "stop_cors_guardia2",
        "name": "Corsico - C.na Guardia",
        "operatore": "STAV",
        "lat": 45.425871,
        "lng": 9.088684
    },
    {
        "id": "stop_cors_emanuele/montello",
        "name": "Corsico - Via V. Emanuele/Montello",
        "operatore": "STAV",
        "lat": 45.429036,
        "lng": 9.101774
    },
    {
        "id": "stop_cors_emanuele/montello2",
        "name": "Corsico - Via V. Emanuele/Montello",
        "operatore": "STAV",
        "lat": 45.429032,
        "lng": 9.101324
    },
    {
        "id": "stop_cors_emanuele2",
        "name": "Corsico - Via V. Emanuele 2",
        "lat": 45.430498,
        "lng": 9.106004,
        "connections": [
            { "name": "325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_cors_emanuele22",
        "name": "Corsico - Via V. Emanuele 2",
        "lat": 45.430982,
        "lng": 9.106219,
        "connections": [
            { "name": "325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_cors_emanuele/ponte",
        "name": "Corsico - Via V. Emanuele/Ponte",
        "lat": 45.433393,
        "lng": 9.108744,
        "connections": [
            { "name": "321 - 325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_cors_emanuele/ponte2",
        "name": "Corsico - Via V. Emanuele/Ponte",
        "lat": 45.433589,
        "lng": 9.108631,
        "connections": [
            { "name": "321 - 325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_cors_diaz",
        "name": "Corsico - Via Milano/Diaz",
        "lat": 45.435558,
        "lng": 9.113168
    },
    {
        "id": "stop_cors_milano/concordia",
        "name": "Corsico - Via Milano/Concordia",
        "lat": 45.435888,
        "lng": 9.115044
    },
    {
        "id": "stop_cors_milano/concordia2",
        "name": "Corsico - Via Milano/Concordia",
        "lat": 45.436140,
        "lng": 9.115710
    },
    {
        "id": "stop_bucc_vig/molino",
        "name": "Buccinasco - Str. Vigevanese/Molino",
        "lat": 45.437141,
        "lng": 9.119983,
        "connections": [
            { "name": "325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_bucc_vig/molino2",
        "name": "Buccinasco - Str. Vigevanese/Molino",
        "lat": 45.437186,
        "lng": 9.119816,
        "connections": [
            { "name": "325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_mil_lore",
        "name": "Milano - Lorenteggio",
        "lat": 45.443407,
        "lng": 9.116356,
        "connections": [
            { "name": "13 - 50 - 64 - 327", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_mil_lore2",
        "name": "Milano - Lorenteggio",
        "lat": 45.443776,
        "lng": 9.116312,
        "connections": [
            { "name": "13 - 50 - 64 - 327", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_mil_lore/bis",
        "name": "Milano - Via Lorenteggio/Bisceglie",
        "lat": 45.445161,
        "lng": 9.120574
    },
    {
        "id": "stop_mil_bis/cic",
        "name": "Milano - Via Bisceglie/Ciconi",
        "lat": 45.452409,
        "lng": 9.117395
    },
    {
        "id": "stop_mil_bis/cic2",
        "name": "Milano - Via Bisceglie/Ciconi",
        "lat": 45.451962,
        "lng": 9.117621
    },
    {
        "id": "stop_mil_bis",
        "name": "Milano - Bisceglie M1",
        "operatore": "STAV",
        "lat": 45.454872,
        "lng": 9.113259,
        "connections": [
            { "name": "M1", "color": "#EE2E24", "txColor": "#ffffff", "icon": "img/M1Logo.png" },
            { "name": "47 - 58 - 63 - 76 - 78 - 321 - 322 - 323 - 327 - 351 - 433", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" },
        ]
    },
    {
        "id": "stop_mil_moro/colombano",
        "name": "Milano - Via L. il Moro/Colombano",
        "lat": 45.438747,
        "lng": 9.125535
    },
    {
        "id": "stop_mil_moro/colombano2",
        "name": "Milano - Via L. il Moro/Colombano",
        "lat": 45.440143,
        "lng": 9.127331
    },
    {
        "id": "stop_mil_moro/merula",
        "name": "Milano - Via L. il Moro/Merula M4",
        "lat": 45.441292,
        "lng": 9.130448,
        "connections": [
            { "name": "M4", "color": "#000080", "txColor": "#ffffff", "icon": "img/M4Logo.png" },
            { "name": "47 - 324 - 325 - 95 - 351", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" },
        ]
    },
    {
        "id": "stop_mil_moro/merula2",
        "name": "Milano - Via L. il Moro/Merula M4",
        "lat": 45.441025,
        "lng": 9.129412,
        "connections": [
            { "name": "M4", "color": "#000080", "txColor": "#ffffff", "icon": "img/M4Logo.png" },
            { "name": "47 - 324 - 325 - 95 - 351", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" },
        ]
    },
    {
        "id": "stop_mil_moro/manfredonia",
        "name": "Milano - Via L. il Moro/Manfredonia",
        "lat": 45.442090,
        "lng": 9.132896
    },
    {
        "id": "stop_mil_moro/manfredonia2",
        "name": "Milano - Via L. il Moro/Manfredonia",
        "lat": 45.442990,
        "lng": 9.135084
    },
    {
        "id": "stop_mil_negrelli",
        "name": "Milano - P.le Negrelli",
        "lat": 45.444536,
        "lng": 9.141222,
        "connections": [
            { "name": "2 - 47 - 325 - 351", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_mil_negrelli2",
        "name": "Milano - P.le Negrelli",
        "lat": 45.444419,
        "lng": 9.140529,
        "connections": [
            { "name": "2 - 47 - 325 - 351", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_mil_moro/milani",
        "name": "Milano - Via L. il Moro/Cav. Don Milani",
        "lat": 45.445551,
        "lng": 9.146031,
        "connections": [
            { "name": "98 - 325", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" }
        ]
    },
    {
        "id": "stop_mil_moro/pestalozzi",
        "name": "Milano - Via L. il Moro/Pestalozzi",
        "lat": 45.447543,
        "lng": 9.155337
    },
    {
        "id": "stop_mil_moro/pestalozzi2",
        "name": "Milano - Via L. il Moro/Pestalozzi",
        "lat": 45.447284,
        "lng": 9.154110
    },
    {
        "id": "stop_mil_cassala",
        "name": "Milano - V.le Cassala",
        "lat": 45.444959,
        "lng": 9.162315


    },
    {
        "id": "stop_mil_cassala2",
        "name": "Milano - V.le Cassala",
        "lat": 45.444787,
        "lng": 9.163604

    },
    {
        "id": "stop_mil_rom",
        "name": "Milano Romolo M2/FS",
        "lat": 45.443980,
        "lng": 9.167638,
        "connections": [
            { "name": "M2", "color": "#5D9732", "txColor": "#ffffff", "icon": "img/M2Logo.png" },
            { "name": "S9", "color": "#A4328A", "txColor": "#ffffff", "icon": "img/S9Logo.png" },
            { "name": "S19", "color": "#67032F", "txColor": "#ffffff", "icon": "img/S19Logo.png" },
            { "name": "R31", "color": "#0462AC", "txColor": "#ffffff", "icon": "img/RegioLogo.png" },
            { "name": "47 - 71 - 90 - 91 - 325 - 351", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/ATMLogo.png" },
            { "name": "83 - 94 - 172", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/AGVLogo.png" }
        ]
    },
    {
        "id": "stop_alb_donatori",
        "name": "Albairate - Via Donatori del Sangue",
        "operatore": "STAV",
        "lat": 45.419227,
        "lng": 8.933913

    },
    {
        "id": "stop_alb_indipendenza/marconi",
        "name": "Albairate - Via Indipendenza/Marconi",
        "operatore": "STAV",
        "lat": 45.419615,
        "lng": 8.936188

    },
    {
        "id": "stop_alb_baracca",
        "name": "Albairate - Via Baracca",
        "operatore": "STAV",
        "lat": 45.418389,
        "lng": 8.941037

    },
    {
        "id": "stop_alb_indipendenza/monti",
        "name": "Albairate - Via Indipendenza/Monti",
        "operatore": "STAV",
        "lat": 45.419912,
        "lng": 8.939658

    },
    {
        "id": "stop_alb_bellini",
        "name": "Albairate - Via Bellini",
        "operatore": "STAV",
        "lat": 45.418702,
        "lng": 8.940552

    },
    {
        "id": "stop_cer_vincenzo",
        "name": "Cerello - P.za S. Vincenzo",
        "operatore": "STAV",
        "lat": 45.446626,
        "lng": 8.925942
    },
    {
        "id": "stop_cer_rosario",
        "name": "Cerello - Via Rosario",
        "operatore": "STAV",
        "lat": 45.450174,
        "lng": 8.924607
    },
    {
        "id": "stop_cer_rosario",
        "name": "Cerello - Via Rosario",
        "operatore": "STAV",
        "lat": 45.450174,
        "lng": 8.924607
    },
    {
        "id": "stop_corb_croce",
        "name": "Cerello - Via B. Croce",
        "operatore": "STAV",
        "lat": 45.460935,
        "lng": 8.919893
    },
    {
        "id": "stop_corb_crove",
        "name": "Corbetta - Via B. Croce",
        "operatore": "STAV",
        "lat": 45.460935,
        "lng": 8.919893
    },
    {
        "id": "stop_corb_repubblica",
        "name": "Corbetta - V.le della Repubblica",
        "operatore": "STAV",
        "lat": 45.465296,
        "lng": 8.911037
    },
    {
        "id": "stop_corb_oberdan",
        "name": "Corbetta - Via Oberdan",
        "operatore": "STAV",
        "lat": 45.470561,
        "lng": 8.910081
    },
    {
        "id": "stop_corb_aprile",
        "name": "Corbetta - P.za XXV Aprile",
        "lat": 45.469679,
        "lng": 8.918464,
        "connections": [
            { "name": "Z620 - Z642", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/MBLogo.png" },
        ]
    },
    {
        "id": "stop_corb_ambrogio",
        "name": "Corbetta - Via S. Ambrogio",
        "lat": 45.473920,
        "lng": 8.918732
    },
    {
        "id": "stop_corb_borletti",
        "name": "Corbetta - V.le Borletti",
        "lat": 45.480772,
        "lng": 8.910637
    },
    {
        "id": "stop_stef_fs",
        "name": "S. Stefano Ticino - T. Stazione FS",
        "lat": 45.481003,
        "lng": 8.916516,
        "connections": [
            { "name": "S6", "color": "#EFD309", "txColor": "#ffffff", "icon": "img/S6Logo.png" },
            { "name": "Z642", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/MBLogo.png" },
        ]
    },
    {
        "id": "stop_stef_repubblica/dante",
        "name": "S. Stefano Ticino - V.le della Repubblica/Dante",
        "lat": 45.483870,
        "lng": 8.919017
    },
    {
        "id": "stop_stef_repubblica/pace",
        "name": "S. Stefano Ticino - V.le della Repubblica/Pace",
        "lat": 45.486250,
        "lng": 8.922823,
        "connections": [
            { "name": "Z642", "color": "#ffffffff", "txColor": "#ffffff", "icon": "img/MBLogo.png" },
        ]
    },

    // FERMATE ATM

    {
        "id": "stop_mil_bisceglieatm",
        "name": "Bisceglie M1",
        "operatore": "ATM",
        "lat": 45.454932,
        "lng": 9.112860,
    },
    {
        "id": "stop_trez_concordia/indipendenza",
        "name": "Trezzano sul Naviglio - Via Concordia/Via Indipendenza",
        "operatore": "ATM",
        "lat": 45.421828,
        "lng": 9.066803,
    },
    {
        "id": "stop_trez_cimitero",
        "name": "Trezzano sul Naviglio - Cimitero",
        "operatore": "ATM",
        "lat": 45.419489,
        "lng": 9.068387,
    },
    {
        "id": "stop_trez_volta/edison",
        "name": "Trezzano sul Naviglio - Via Volta/Via Edison",
        "operatore": "ATM",
        "lat": 45.421161,
        "lng": 9.064586,
    },
    {
        "id": "stop_trez_dante/bramante",
        "name": "Trezzano sul Naviglio - Via Dante/Via Bramante",
        "operatore": "ATM",
        "lat": 45.423234,
        "lng": 9.060368,
    },
    {
        "id": "stop_trez_buonarroti/francesca",
        "name": "Trezzano sul Naviglio - Via Buonarroti/Via P. Della Francesca",
        "operatore": "ATM",
        "lat": 45.421628,
        "lng": 9.054779,
    },
    {
        "id": "stop_trez_buonarroti/francesca2",
        "name": "Trezzano sul Naviglio - Via Buonarroti/Via P. Della Francesca",
        "operatore": "ATM",
        "lat": 45.420984,
        "lng": 9.055108,
    },
    {
        "id": "stop_trez_marconi/malibran",
        "name": "Trezzano sul Naviglio - Via Marconi/Via Malibran",
        "operatore": "ATM",
        "lat": 45.425200,
        "lng": 9.051460,
    },
    {
        "id": "stop_trez_marconi/malibran2",
        "name": "Trezzano sul Naviglio - Via Marconi/Via Malibran",
        "operatore": "ATM",
        "lat": 45.424667,
        "lng": 9.051772,
    },
    {
        "id": "stop_trez_morona",
        "name": "Trezzano sul Naviglio - Via Morona",
        "operatore": "ATM",
        "lat": 45.426634,
        "lng": 9.050345,
    },
    {
        "id": "stop_trez_morona2",
        "name": "Trezzano sul Naviglio - Via Morona",
        "operatore": "ATM",
        "lat": 45.427176,
        "lng": 9.050642,
    },
    {
        "id": "stop_trez_petrarca/donatello",
        "name": "Trezzano sul Naviglio - Via Petrarca/Via Donatello",
        "operatore": "ATM",
        "lat": 45.428092,
        "lng": 9.051624,
    },
    {
        "id": "stop_trez_morona/reni",
        "name": "Trezzano sul Naviglio - Via Morona/Via Reni",
        "operatore": "ATM",
        "lat": 45.430850,
        "lng": 9.059174,
    },
    {
        "id": "stop_trez_morona/reni2",
        "name": "Trezzano sul Naviglio - Via Morona/Via Reni",
        "operatore": "ATM",
        "lat": 45.430115,
        "lng": 9.058238,
    },
    {
        "id": "stop_trez_cavour/azeglio",
        "name": "Trezzano sul Naviglio - Via Cavour/Via D'Azeglio",
        "operatore": "ATM",
        "lat": 45.427086,
        "lng": 9.063715,
    },
    {
        "id": "stop_trez_metastasio/boccaccio",
        "name": "Trezzano sul Naviglio - Via Metastasio/Via Boccaccio",
        "operatore": "ATM",
        "lat": 45.418563,
        "lng": 9.056997,
    },
    {
        "id": "stop_trez_boccaccio/caro",
        "name": "Trezzano sul Naviglio - Via Boccaccio/Via Caro",
        "operatore": "ATM",
        "lat": 45.415532,
        "lng": 9.049760,
    },
    {
        "id": "stop_trez_boccaccio/kennedy",
        "name": "Trezzano sul Naviglio - Via Boccaccio/Via Kennedy",
        "operatore": "ATM",
        "lat": 45.414257,
        "lng": 9.046471,
    },
    {
        "id": "stop_trez_boccaccio/eching",
        "name": "Trezzano sul Naviglio - Via Boccaccio/Via Eching",
        "operatore": "ATM",
        "lat": 45.413219,
        "lng": 9.043753,
    },
    {
        "id": "stop_trez_zanoatm",
        "name": "Trezzano sul Naviglio - Stab. Zanoletti",
        "lat": 45.414219,
        "lng": 9.041084,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa90",
        "name": "Cusago - Viale Europa 90",
        "lat": 45.433314,
        "lng": 9.049704,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa902",
        "name": "Cusago - Viale Europa 90",
        "lat": 45.433187,
        "lng": 9.049603,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa/ferraris",
        "name": "Cusago - Viale Europa/Via Ferraris",
        "lat": 45.436576,
        "lng": 9.046978,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa/ferraris2",
        "name": "Cusago - Viale Europa/Via Ferraris",
        "lat": 45.437423,
        "lng": 9.045977,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa/davinci",
        "name": "Cusago - Viale Europa/Via L. Da Vinci",
        "lat": 45.441880,
        "lng": 9.042494,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa/davinci2",
        "name": "Cusago - Viale Europa/Via L. Da Vinci",
        "lat": 45.441799,
        "lng": 9.042325,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa/baggio",
        "name": "Cusago - Viale Europa/Via Baggio",
        "lat": 45.448215,
        "lng": 9.037638,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_europa/baggio2",
        "name": "Cusago - Viale Europa/ViaBaggio",
        "lat": 45.448056,
        "lng": 9.037606,
        "operatore": "ATM",
    },
    {
        "id": "stop_cus_baggio",
        "name": "Cusago - Via Baggio",
        "lat": 45.448176,
        "lng": 9.034759,
        "operatore": "ATM",
    },
    {
        "id": "stop_mil_lore/bis2",
        "name": "Milano - Via Lorenteggio/Via Bisceglie",
        "operatore": "ATM",
        "lat": 45.445062,
        "lng": 9.121196,
    },
    {
        "id": "stop_mil_bisceglie/bensi",
        "name": "Milano - Via Bisceglie/Via Bensi",
        "operatore": "ATM",
        "lat": 45.447632,
        "lng": 9.120267,
    },
];
