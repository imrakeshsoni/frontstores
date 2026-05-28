// [study] [all tenants]
import { useState } from 'react';

interface Element {
  number: number;
  symbol: string;
  name: string;
  mass: string;
  category: string;
  electronConfig: string;
  state: string;
  discoveredBy: string;
  group?: number;
  period: number;
}

const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  'alkali-metal':        { label: 'Alkali Metal',         color: '#dc2626', bg: '#fee2e2' },
  'alkaline-earth':      { label: 'Alkaline Earth Metal',  color: '#d97706', bg: '#fef3c7' },
  'transition-metal':    { label: 'Transition Metal',      color: '#2563eb', bg: '#dbeafe' },
  'post-transition':     { label: 'Post-Transition Metal', color: '#0891b2', bg: '#cffafe' },
  'metalloid':           { label: 'Metalloid',             color: '#7c3aed', bg: '#ede9fe' },
  'nonmetal':            { label: 'Nonmetal',              color: '#16a34a', bg: '#dcfce7' },
  'halogen':             { label: 'Halogen',               color: '#0d9488', bg: '#ccfbf1' },
  'noble-gas':           { label: 'Noble Gas',             color: '#9333ea', bg: '#f3e8ff' },
  'lanthanide':          { label: 'Lanthanide',            color: '#be185d', bg: '#fce7f3' },
  'actinide':            { label: 'Actinide',              color: '#b45309', bg: '#fef9c3' },
};

const ELEMENTS: Element[] = [
  { number:1,  symbol:'H',  name:'Hydrogen',      mass:'1.008',    category:'nonmetal',        electronConfig:'1s¹',                       state:'Gas',   discoveredBy:'Henry Cavendish (1766)',       group:1,  period:1 },
  { number:2,  symbol:'He', name:'Helium',        mass:'4.003',    category:'noble-gas',        electronConfig:'1s²',                       state:'Gas',   discoveredBy:'Pierre Janssen (1868)',        group:18, period:1 },
  { number:3,  symbol:'Li', name:'Lithium',       mass:'6.941',    category:'alkali-metal',     electronConfig:'[He] 2s¹',                  state:'Solid', discoveredBy:'Johan Arfvedson (1817)',       group:1,  period:2 },
  { number:4,  symbol:'Be', name:'Beryllium',     mass:'9.012',    category:'alkaline-earth',   electronConfig:'[He] 2s²',                  state:'Solid', discoveredBy:'Louis Vauquelin (1798)',       group:2,  period:2 },
  { number:5,  symbol:'B',  name:'Boron',         mass:'10.811',   category:'metalloid',        electronConfig:'[He] 2s² 2p¹',              state:'Solid', discoveredBy:'Gay-Lussac & Thenard (1808)', group:13, period:2 },
  { number:6,  symbol:'C',  name:'Carbon',        mass:'12.011',   category:'nonmetal',         electronConfig:'[He] 2s² 2p²',              state:'Solid', discoveredBy:'Ancient',                     group:14, period:2 },
  { number:7,  symbol:'N',  name:'Nitrogen',      mass:'14.007',   category:'nonmetal',         electronConfig:'[He] 2s² 2p³',              state:'Gas',   discoveredBy:'Daniel Rutherford (1772)',     group:15, period:2 },
  { number:8,  symbol:'O',  name:'Oxygen',        mass:'15.999',   category:'nonmetal',         electronConfig:'[He] 2s² 2p⁴',              state:'Gas',   discoveredBy:'Carl Scheele (1772)',          group:16, period:2 },
  { number:9,  symbol:'F',  name:'Fluorine',      mass:'18.998',   category:'halogen',          electronConfig:'[He] 2s² 2p⁵',              state:'Gas',   discoveredBy:'Henri Moissan (1886)',         group:17, period:2 },
  { number:10, symbol:'Ne', name:'Neon',          mass:'20.180',   category:'noble-gas',        electronConfig:'[He] 2s² 2p⁶',              state:'Gas',   discoveredBy:'William Ramsay (1898)',        group:18, period:2 },
  { number:11, symbol:'Na', name:'Sodium',        mass:'22.990',   category:'alkali-metal',     electronConfig:'[Ne] 3s¹',                  state:'Solid', discoveredBy:'Humphry Davy (1807)',          group:1,  period:3 },
  { number:12, symbol:'Mg', name:'Magnesium',     mass:'24.305',   category:'alkaline-earth',   electronConfig:'[Ne] 3s²',                  state:'Solid', discoveredBy:'Joseph Black (1755)',          group:2,  period:3 },
  { number:13, symbol:'Al', name:'Aluminium',     mass:'26.982',   category:'post-transition',  electronConfig:'[Ne] 3s² 3p¹',              state:'Solid', discoveredBy:'Hans Christian Oersted (1825)',group:13, period:3 },
  { number:14, symbol:'Si', name:'Silicon',       mass:'28.086',   category:'metalloid',        electronConfig:'[Ne] 3s² 3p²',              state:'Solid', discoveredBy:'Jöns Jacob Berzelius (1824)',  group:14, period:3 },
  { number:15, symbol:'P',  name:'Phosphorus',    mass:'30.974',   category:'nonmetal',         electronConfig:'[Ne] 3s² 3p³',              state:'Solid', discoveredBy:'Hennig Brand (1669)',          group:15, period:3 },
  { number:16, symbol:'S',  name:'Sulfur',        mass:'32.065',   category:'nonmetal',         electronConfig:'[Ne] 3s² 3p⁴',              state:'Solid', discoveredBy:'Ancient',                     group:16, period:3 },
  { number:17, symbol:'Cl', name:'Chlorine',      mass:'35.453',   category:'halogen',          electronConfig:'[Ne] 3s² 3p⁵',              state:'Gas',   discoveredBy:'Carl Scheele (1774)',          group:17, period:3 },
  { number:18, symbol:'Ar', name:'Argon',         mass:'39.948',   category:'noble-gas',        electronConfig:'[Ne] 3s² 3p⁶',              state:'Gas',   discoveredBy:'Lord Rayleigh (1894)',         group:18, period:3 },
  { number:19, symbol:'K',  name:'Potassium',     mass:'39.098',   category:'alkali-metal',     electronConfig:'[Ar] 4s¹',                  state:'Solid', discoveredBy:'Humphry Davy (1807)',          group:1,  period:4 },
  { number:20, symbol:'Ca', name:'Calcium',       mass:'40.078',   category:'alkaline-earth',   electronConfig:'[Ar] 4s²',                  state:'Solid', discoveredBy:'Humphry Davy (1808)',          group:2,  period:4 },
  { number:21, symbol:'Sc', name:'Scandium',      mass:'44.956',   category:'transition-metal', electronConfig:'[Ar] 3d¹ 4s²',              state:'Solid', discoveredBy:'Lars Nilson (1879)',           group:3,  period:4 },
  { number:22, symbol:'Ti', name:'Titanium',      mass:'47.867',   category:'transition-metal', electronConfig:'[Ar] 3d² 4s²',              state:'Solid', discoveredBy:'William Gregor (1791)',        group:4,  period:4 },
  { number:23, symbol:'V',  name:'Vanadium',      mass:'50.942',   category:'transition-metal', electronConfig:'[Ar] 3d³ 4s²',              state:'Solid', discoveredBy:'Andrés del Río (1801)',        group:5,  period:4 },
  { number:24, symbol:'Cr', name:'Chromium',      mass:'51.996',   category:'transition-metal', electronConfig:'[Ar] 3d⁵ 4s¹',              state:'Solid', discoveredBy:'Louis Nicolas Vauquelin (1798)',group:6, period:4 },
  { number:25, symbol:'Mn', name:'Manganese',     mass:'54.938',   category:'transition-metal', electronConfig:'[Ar] 3d⁵ 4s²',              state:'Solid', discoveredBy:'Ignatius Gottfried Kaim (1770)',group:7, period:4 },
  { number:26, symbol:'Fe', name:'Iron',          mass:'55.845',   category:'transition-metal', electronConfig:'[Ar] 3d⁶ 4s²',              state:'Solid', discoveredBy:'Ancient',                     group:8,  period:4 },
  { number:27, symbol:'Co', name:'Cobalt',        mass:'58.933',   category:'transition-metal', electronConfig:'[Ar] 3d⁷ 4s²',              state:'Solid', discoveredBy:'Georg Brandt (1735)',          group:9,  period:4 },
  { number:28, symbol:'Ni', name:'Nickel',        mass:'58.693',   category:'transition-metal', electronConfig:'[Ar] 3d⁸ 4s²',              state:'Solid', discoveredBy:'Axel Fredrik Cronstedt (1751)',group:10,period:4 },
  { number:29, symbol:'Cu', name:'Copper',        mass:'63.546',   category:'transition-metal', electronConfig:'[Ar] 3d¹⁰ 4s¹',             state:'Solid', discoveredBy:'Ancient',                     group:11, period:4 },
  { number:30, symbol:'Zn', name:'Zinc',          mass:'65.38',    category:'transition-metal', electronConfig:'[Ar] 3d¹⁰ 4s²',             state:'Solid', discoveredBy:'Ancient',                     group:12, period:4 },
  { number:31, symbol:'Ga', name:'Gallium',       mass:'69.723',   category:'post-transition',  electronConfig:'[Ar] 3d¹⁰ 4s² 4p¹',         state:'Solid', discoveredBy:'Paul Emile Lecoq (1875)',      group:13, period:4 },
  { number:32, symbol:'Ge', name:'Germanium',     mass:'72.630',   category:'metalloid',        electronConfig:'[Ar] 3d¹⁰ 4s² 4p²',         state:'Solid', discoveredBy:'Clemens Winkler (1886)',       group:14, period:4 },
  { number:33, symbol:'As', name:'Arsenic',       mass:'74.922',   category:'metalloid',        electronConfig:'[Ar] 3d¹⁰ 4s² 4p³',         state:'Solid', discoveredBy:'Albertus Magnus (1250)',       group:15, period:4 },
  { number:34, symbol:'Se', name:'Selenium',      mass:'78.971',   category:'nonmetal',         electronConfig:'[Ar] 3d¹⁰ 4s² 4p⁴',         state:'Solid', discoveredBy:'Jöns Jacob Berzelius (1817)',  group:16, period:4 },
  { number:35, symbol:'Br', name:'Bromine',       mass:'79.904',   category:'halogen',          electronConfig:'[Ar] 3d¹⁰ 4s² 4p⁵',         state:'Liquid',discoveredBy:'Antoine Balard (1826)',        group:17, period:4 },
  { number:36, symbol:'Kr', name:'Krypton',       mass:'83.798',   category:'noble-gas',        electronConfig:'[Ar] 3d¹⁰ 4s² 4p⁶',         state:'Gas',   discoveredBy:'William Ramsay (1898)',        group:18, period:4 },
  { number:37, symbol:'Rb', name:'Rubidium',      mass:'85.468',   category:'alkali-metal',     electronConfig:'[Kr] 5s¹',                  state:'Solid', discoveredBy:'Robert Bunsen (1861)',         group:1,  period:5 },
  { number:38, symbol:'Sr', name:'Strontium',     mass:'87.62',    category:'alkaline-earth',   electronConfig:'[Kr] 5s²',                  state:'Solid', discoveredBy:'Adair Crawford (1790)',        group:2,  period:5 },
  { number:39, symbol:'Y',  name:'Yttrium',       mass:'88.906',   category:'transition-metal', electronConfig:'[Kr] 4d¹ 5s²',              state:'Solid', discoveredBy:'Johan Gadolin (1794)',         group:3,  period:5 },
  { number:40, symbol:'Zr', name:'Zirconium',     mass:'91.224',   category:'transition-metal', electronConfig:'[Kr] 4d² 5s²',              state:'Solid', discoveredBy:'Martin Heinrich Klaproth (1789)',group:4,period:5 },
  { number:41, symbol:'Nb', name:'Niobium',       mass:'92.906',   category:'transition-metal', electronConfig:'[Kr] 4d⁴ 5s¹',              state:'Solid', discoveredBy:'Charles Hatchett (1801)',      group:5,  period:5 },
  { number:42, symbol:'Mo', name:'Molybdenum',    mass:'95.96',    category:'transition-metal', electronConfig:'[Kr] 4d⁵ 5s¹',              state:'Solid', discoveredBy:'Carl Scheele (1778)',          group:6,  period:5 },
  { number:43, symbol:'Tc', name:'Technetium',    mass:'(98)',     category:'transition-metal', electronConfig:'[Kr] 4d⁵ 5s²',              state:'Solid', discoveredBy:'Carlo Perrier (1937)',         group:7,  period:5 },
  { number:44, symbol:'Ru', name:'Ruthenium',     mass:'101.07',   category:'transition-metal', electronConfig:'[Kr] 4d⁷ 5s¹',              state:'Solid', discoveredBy:'Karl Ernst Claus (1844)',      group:8,  period:5 },
  { number:45, symbol:'Rh', name:'Rhodium',       mass:'102.906',  category:'transition-metal', electronConfig:'[Kr] 4d⁸ 5s¹',              state:'Solid', discoveredBy:'William Hyde Wollaston (1804)',group:9,  period:5 },
  { number:46, symbol:'Pd', name:'Palladium',     mass:'106.42',   category:'transition-metal', electronConfig:'[Kr] 4d¹⁰',                 state:'Solid', discoveredBy:'William Hyde Wollaston (1803)',group:10, period:5 },
  { number:47, symbol:'Ag', name:'Silver',        mass:'107.868',  category:'transition-metal', electronConfig:'[Kr] 4d¹⁰ 5s¹',             state:'Solid', discoveredBy:'Ancient',                     group:11, period:5 },
  { number:48, symbol:'Cd', name:'Cadmium',       mass:'112.411',  category:'transition-metal', electronConfig:'[Kr] 4d¹⁰ 5s²',             state:'Solid', discoveredBy:'Karl Samuel Leberecht Hermann (1817)',group:12,period:5 },
  { number:49, symbol:'In', name:'Indium',        mass:'114.818',  category:'post-transition',  electronConfig:'[Kr] 4d¹⁰ 5s² 5p¹',         state:'Solid', discoveredBy:'Ferdinand Reich (1863)',       group:13, period:5 },
  { number:50, symbol:'Sn', name:'Tin',           mass:'118.710',  category:'post-transition',  electronConfig:'[Kr] 4d¹⁰ 5s² 5p²',         state:'Solid', discoveredBy:'Ancient',                     group:14, period:5 },
  { number:51, symbol:'Sb', name:'Antimony',      mass:'121.760',  category:'metalloid',        electronConfig:'[Kr] 4d¹⁰ 5s² 5p³',         state:'Solid', discoveredBy:'Ancient',                     group:15, period:5 },
  { number:52, symbol:'Te', name:'Tellurium',     mass:'127.60',   category:'metalloid',        electronConfig:'[Kr] 4d¹⁰ 5s² 5p⁴',         state:'Solid', discoveredBy:'Franz-Joseph Müller (1782)',   group:16, period:5 },
  { number:53, symbol:'I',  name:'Iodine',        mass:'126.904',  category:'halogen',          electronConfig:'[Kr] 4d¹⁰ 5s² 5p⁵',         state:'Solid', discoveredBy:'Bernard Courtois (1811)',      group:17, period:5 },
  { number:54, symbol:'Xe', name:'Xenon',         mass:'131.293',  category:'noble-gas',        electronConfig:'[Kr] 4d¹⁰ 5s² 5p⁶',         state:'Gas',   discoveredBy:'William Ramsay (1898)',        group:18, period:5 },
  { number:55, symbol:'Cs', name:'Caesium',       mass:'132.905',  category:'alkali-metal',     electronConfig:'[Xe] 6s¹',                  state:'Solid', discoveredBy:'Robert Bunsen (1860)',         group:1,  period:6 },
  { number:56, symbol:'Ba', name:'Barium',        mass:'137.327',  category:'alkaline-earth',   electronConfig:'[Xe] 6s²',                  state:'Solid', discoveredBy:'Carl Scheele (1774)',          group:2,  period:6 },
  { number:57, symbol:'La', name:'Lanthanum',     mass:'138.905',  category:'lanthanide',       electronConfig:'[Xe] 5d¹ 6s²',              state:'Solid', discoveredBy:'Carl Gustav Mosander (1839)',  group:3,  period:6 },
  { number:58, symbol:'Ce', name:'Cerium',        mass:'140.116',  category:'lanthanide',       electronConfig:'[Xe] 4f¹ 5d¹ 6s²',          state:'Solid', discoveredBy:'Martin Heinrich Klaproth (1803)',period:9,group:4 },
  { number:59, symbol:'Pr', name:'Praseodymium',  mass:'140.908',  category:'lanthanide',       electronConfig:'[Xe] 4f³ 6s²',              state:'Solid', discoveredBy:'Carl Auer von Welsbach (1885)',period:9,group:5 },
  { number:60, symbol:'Nd', name:'Neodymium',     mass:'144.242',  category:'lanthanide',       electronConfig:'[Xe] 4f⁴ 6s²',              state:'Solid', discoveredBy:'Carl Auer von Welsbach (1885)',period:9,group:6 },
  { number:61, symbol:'Pm', name:'Promethium',    mass:'(145)',    category:'lanthanide',       electronConfig:'[Xe] 4f⁵ 6s²',              state:'Solid', discoveredBy:'Jacob Marinsky (1945)',        period:9,group:7 },
  { number:62, symbol:'Sm', name:'Samarium',      mass:'150.36',   category:'lanthanide',       electronConfig:'[Xe] 4f⁶ 6s²',              state:'Solid', discoveredBy:'Lecoq de Boisbaudran (1879)',  period:9,group:8 },
  { number:63, symbol:'Eu', name:'Europium',      mass:'151.964',  category:'lanthanide',       electronConfig:'[Xe] 4f⁷ 6s²',              state:'Solid', discoveredBy:'Eugène-Anatole Demarçay (1896)',period:9,group:9 },
  { number:64, symbol:'Gd', name:'Gadolinium',    mass:'157.25',   category:'lanthanide',       electronConfig:'[Xe] 4f⁷ 5d¹ 6s²',          state:'Solid', discoveredBy:'Jean Charles Galissard (1880)',period:9,group:10 },
  { number:65, symbol:'Tb', name:'Terbium',       mass:'158.925',  category:'lanthanide',       electronConfig:'[Xe] 4f⁹ 6s²',              state:'Solid', discoveredBy:'Carl Gustaf Mosander (1843)',  period:9,group:11 },
  { number:66, symbol:'Dy', name:'Dysprosium',    mass:'162.500',  category:'lanthanide',       electronConfig:'[Xe] 4f¹⁰ 6s²',             state:'Solid', discoveredBy:'Lecoq de Boisbaudran (1886)',  period:9,group:12 },
  { number:67, symbol:'Ho', name:'Holmium',       mass:'164.930',  category:'lanthanide',       electronConfig:'[Xe] 4f¹¹ 6s²',             state:'Solid', discoveredBy:'Marc Delafontaine (1878)',     period:9,group:13 },
  { number:68, symbol:'Er', name:'Erbium',        mass:'167.259',  category:'lanthanide',       electronConfig:'[Xe] 4f¹² 6s²',             state:'Solid', discoveredBy:'Carl Gustaf Mosander (1842)',  period:9,group:14 },
  { number:69, symbol:'Tm', name:'Thulium',       mass:'168.934',  category:'lanthanide',       electronConfig:'[Xe] 4f¹³ 6s²',             state:'Solid', discoveredBy:'Per Teodor Cleve (1879)',      period:9,group:15 },
  { number:70, symbol:'Yb', name:'Ytterbium',     mass:'173.054',  category:'lanthanide',       electronConfig:'[Xe] 4f¹⁴ 6s²',             state:'Solid', discoveredBy:'Jean Charles Galissard (1878)',period:9,group:16 },
  { number:71, symbol:'Lu', name:'Lutetium',      mass:'174.967',  category:'lanthanide',       electronConfig:'[Xe] 4f¹⁴ 5d¹ 6s²',         state:'Solid', discoveredBy:'Georges Urbain (1907)',        group:3,  period:6 },
  { number:72, symbol:'Hf', name:'Hafnium',       mass:'178.49',   category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d² 6s²',         state:'Solid', discoveredBy:'Dirk Coster (1923)',           group:4,  period:6 },
  { number:73, symbol:'Ta', name:'Tantalum',      mass:'180.948',  category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d³ 6s²',         state:'Solid', discoveredBy:'Anders Gustaf Ekeberg (1802)', group:5,  period:6 },
  { number:74, symbol:'W',  name:'Tungsten',      mass:'183.84',   category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d⁴ 6s²',         state:'Solid', discoveredBy:'Fausto and Juan José Elhuyar (1783)',group:6,period:6 },
  { number:75, symbol:'Re', name:'Rhenium',       mass:'186.207',  category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d⁵ 6s²',         state:'Solid', discoveredBy:'Masataka Ogawa (1908)',        group:7,  period:6 },
  { number:76, symbol:'Os', name:'Osmium',        mass:'190.23',   category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d⁶ 6s²',         state:'Solid', discoveredBy:'Smithson Tennant (1803)',      group:8,  period:6 },
  { number:77, symbol:'Ir', name:'Iridium',       mass:'192.217',  category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d⁷ 6s²',         state:'Solid', discoveredBy:'Smithson Tennant (1803)',      group:9,  period:6 },
  { number:78, symbol:'Pt', name:'Platinum',      mass:'195.084',  category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d⁹ 6s¹',         state:'Solid', discoveredBy:'Antonio de Ulloa (1735)',      group:10, period:6 },
  { number:79, symbol:'Au', name:'Gold',          mass:'196.967',  category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s¹',        state:'Solid', discoveredBy:'Ancient',                     group:11, period:6 },
  { number:80, symbol:'Hg', name:'Mercury',       mass:'200.592',  category:'transition-metal', electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s²',        state:'Liquid',discoveredBy:'Ancient',                     group:12, period:6 },
  { number:81, symbol:'Tl', name:'Thallium',      mass:'204.383',  category:'post-transition',  electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹',    state:'Solid', discoveredBy:'William Crookes (1861)',       group:13, period:6 },
  { number:82, symbol:'Pb', name:'Lead',          mass:'207.2',    category:'post-transition',  electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²',    state:'Solid', discoveredBy:'Ancient',                     group:14, period:6 },
  { number:83, symbol:'Bi', name:'Bismuth',       mass:'208.980',  category:'post-transition',  electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³',    state:'Solid', discoveredBy:'Claude François Geoffroy (1753)',group:15,period:6 },
  { number:84, symbol:'Po', name:'Polonium',      mass:'(209)',    category:'metalloid',        electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴',    state:'Solid', discoveredBy:'Marie & Pierre Curie (1898)', group:16, period:6 },
  { number:85, symbol:'At', name:'Astatine',      mass:'(210)',    category:'halogen',          electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵',    state:'Solid', discoveredBy:'Dale Corson (1940)',           group:17, period:6 },
  { number:86, symbol:'Rn', name:'Radon',         mass:'(222)',    category:'noble-gas',        electronConfig:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶',    state:'Gas',   discoveredBy:'Friedrich Ernst Dorn (1900)',  group:18, period:6 },
  { number:87, symbol:'Fr', name:'Francium',      mass:'(223)',    category:'alkali-metal',     electronConfig:'[Rn] 7s¹',                  state:'Solid', discoveredBy:'Marguerite Perey (1939)',      group:1,  period:7 },
  { number:88, symbol:'Ra', name:'Radium',        mass:'(226)',    category:'alkaline-earth',   electronConfig:'[Rn] 7s²',                  state:'Solid', discoveredBy:'Marie & Pierre Curie (1898)', group:2,  period:7 },
  { number:89, symbol:'Ac', name:'Actinium',      mass:'(227)',    category:'actinide',         electronConfig:'[Rn] 6d¹ 7s²',              state:'Solid', discoveredBy:'André-Louis Debierne (1899)',  group:3,  period:7 },
  { number:90, symbol:'Th', name:'Thorium',       mass:'232.038',  category:'actinide',         electronConfig:'[Rn] 6d² 7s²',              state:'Solid', discoveredBy:'Jöns Jakob Berzelius (1829)',  period:10,group:4 },
  { number:91, symbol:'Pa', name:'Protactinium',  mass:'231.036',  category:'actinide',         electronConfig:'[Rn] 5f² 6d¹ 7s²',          state:'Solid', discoveredBy:'Otto Hahn (1913)',             period:10,group:5 },
  { number:92, symbol:'U',  name:'Uranium',       mass:'238.029',  category:'actinide',         electronConfig:'[Rn] 5f³ 6d¹ 7s²',          state:'Solid', discoveredBy:'Martin Heinrich Klaproth (1789)',period:10,group:6 },
  { number:93, symbol:'Np', name:'Neptunium',     mass:'(237)',    category:'actinide',         electronConfig:'[Rn] 5f⁴ 6d¹ 7s²',          state:'Solid', discoveredBy:'Edwin McMillan (1940)',        period:10,group:7 },
  { number:94, symbol:'Pu', name:'Plutonium',     mass:'(244)',    category:'actinide',         electronConfig:'[Rn] 5f⁶ 7s²',              state:'Solid', discoveredBy:'Glenn Seaborg (1940)',         period:10,group:8 },
  { number:95, symbol:'Am', name:'Americium',     mass:'(243)',    category:'actinide',         electronConfig:'[Rn] 5f⁷ 7s²',              state:'Solid', discoveredBy:'Glenn Seaborg (1944)',         period:10,group:9 },
  { number:96, symbol:'Cm', name:'Curium',        mass:'(247)',    category:'actinide',         electronConfig:'[Rn] 5f⁷ 6d¹ 7s²',          state:'Solid', discoveredBy:'Glenn Seaborg (1944)',         period:10,group:10 },
  { number:97, symbol:'Bk', name:'Berkelium',     mass:'(247)',    category:'actinide',         electronConfig:'[Rn] 5f⁹ 7s²',              state:'Solid', discoveredBy:'Glenn Seaborg (1949)',         period:10,group:11 },
  { number:98, symbol:'Cf', name:'Californium',   mass:'(251)',    category:'actinide',         electronConfig:'[Rn] 5f¹⁰ 7s²',             state:'Solid', discoveredBy:'Glenn Seaborg (1950)',         period:10,group:12 },
  { number:99, symbol:'Es', name:'Einsteinium',   mass:'(252)',    category:'actinide',         electronConfig:'[Rn] 5f¹¹ 7s²',             state:'Solid', discoveredBy:'Albert Ghiorso (1952)',        period:10,group:13 },
  { number:100,symbol:'Fm', name:'Fermium',       mass:'(257)',    category:'actinide',         electronConfig:'[Rn] 5f¹² 7s²',             state:'Solid', discoveredBy:'Albert Ghiorso (1952)',        period:10,group:14 },
  { number:101,symbol:'Md', name:'Mendelevium',   mass:'(258)',    category:'actinide',         electronConfig:'[Rn] 5f¹³ 7s²',             state:'Solid', discoveredBy:'Glenn Seaborg (1955)',         period:10,group:15 },
  { number:102,symbol:'No', name:'Nobelium',      mass:'(259)',    category:'actinide',         electronConfig:'[Rn] 5f¹⁴ 7s²',             state:'Solid', discoveredBy:'Nobel Institute (1957)',       period:10,group:16 },
  { number:103,symbol:'Lr', name:'Lawrencium',    mass:'(266)',    category:'actinide',         electronConfig:'[Rn] 5f¹⁴ 7s² 7p¹',         state:'Solid', discoveredBy:'Albert Ghiorso (1961)',        group:3,  period:7 },
  { number:104,symbol:'Rf', name:'Rutherfordium', mass:'(267)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d² 7s²',         state:'Solid', discoveredBy:'JINR/LBNL (1964)',             group:4,  period:7 },
  { number:105,symbol:'Db', name:'Dubnium',       mass:'(268)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d³ 7s²',         state:'Solid', discoveredBy:'JINR/LBNL (1967)',             group:5,  period:7 },
  { number:106,symbol:'Sg', name:'Seaborgium',    mass:'(269)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d⁴ 7s²',         state:'Solid', discoveredBy:'LBNL (1974)',                  group:6,  period:7 },
  { number:107,symbol:'Bh', name:'Bohrium',       mass:'(270)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d⁵ 7s²',         state:'Solid', discoveredBy:'GSI (1981)',                   group:7,  period:7 },
  { number:108,symbol:'Hs', name:'Hassium',       mass:'(277)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d⁶ 7s²',         state:'Solid', discoveredBy:'GSI (1984)',                   group:8,  period:7 },
  { number:109,symbol:'Mt', name:'Meitnerium',    mass:'(278)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d⁷ 7s²',         state:'Solid', discoveredBy:'GSI (1982)',                   group:9,  period:7 },
  { number:110,symbol:'Ds', name:'Darmstadtium',  mass:'(281)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d⁸ 7s²',         state:'Solid', discoveredBy:'GSI (1994)',                   group:10, period:7 },
  { number:111,symbol:'Rg', name:'Roentgenium',   mass:'(282)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s¹',        state:'Solid', discoveredBy:'GSI (1994)',                   group:11, period:7 },
  { number:112,symbol:'Cn', name:'Copernicium',   mass:'(285)',    category:'transition-metal', electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s²',        state:'Solid', discoveredBy:'GSI (1996)',                   group:12, period:7 },
  { number:113,symbol:'Nh', name:'Nihonium',      mass:'(286)',    category:'post-transition',  electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹',    state:'Solid', discoveredBy:'RIKEN (2004)',                 group:13, period:7 },
  { number:114,symbol:'Fl', name:'Flerovium',     mass:'(289)',    category:'post-transition',  electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²',    state:'Solid', discoveredBy:'JINR (1998)',                  group:14, period:7 },
  { number:115,symbol:'Mc', name:'Moscovium',     mass:'(290)',    category:'post-transition',  electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³',    state:'Solid', discoveredBy:'JINR/LLNL (2003)',             group:15, period:7 },
  { number:116,symbol:'Lv', name:'Livermorium',   mass:'(293)',    category:'post-transition',  electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴',    state:'Solid', discoveredBy:'JINR/LLNL (2000)',             group:16, period:7 },
  { number:117,symbol:'Ts', name:'Tennessine',    mass:'(294)',    category:'halogen',          electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵',    state:'Solid', discoveredBy:'JINR/LLNL (2010)',             group:17, period:7 },
  { number:118,symbol:'Og', name:'Oganesson',     mass:'(294)',    category:'noble-gas',        electronConfig:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶',    state:'Gas',   discoveredBy:'JINR/LLNL (2002)',             group:18, period:7 },
];

// Grid layout: period rows 1-7, group columns 1-18; lanthanides go on row 9, actinides on row 10
function buildGrid() {
  const grid: (Element | null)[][] = Array.from({ length: 10 }, () => Array(18).fill(null));
  for (const el of ELEMENTS) {
    const row = el.period - 1;
    const col = (el.group ?? 1) - 1;
    if (row >= 0 && row < 10 && col >= 0 && col < 18) {
      grid[row][col] = el;
    }
  }
  return grid;
}

export function PeriodicTablePage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Element | null>(null);
  const grid = buildGrid();
  const q = search.toLowerCase().trim();

  function isMatch(el: Element) {
    if (!q) return false;
    return el.name.toLowerCase().includes(q) || el.symbol.toLowerCase().includes(q) || String(el.number).includes(q);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Periodic Table</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>All 118 elements — click any cell for details</p>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search element, symbol, or number…"
          className="px-4 py-2 rounded-xl border text-sm w-72"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <div key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cat.bg, color: cat.color }}>
            <div className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
            {cat.label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: 1100 }}>
          {/* Group headers */}
          <div className="flex mb-1">
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} className="text-center text-xs font-bold flex-shrink-0" style={{ width: 58, color: 'var(--text-tertiary)' }}>{i + 1}</div>
            ))}
          </div>
          {grid.map((row, ri) => (
            <div key={ri} className="flex" style={{ marginBottom: ri === 7 ? 12 : 2 }}>
              {row.map((el, ci) => {
                if (!el) return <div key={ci} style={{ width: 58, height: 64, flexShrink: 0 }} />;
                const cat = CATEGORIES[el.category] ?? { color: '#64748b', bg: '#f1f5f9' };
                const highlight = q && isMatch(el);
                return (
                  <button
                    key={ci}
                    onClick={() => setSelected(el)}
                    style={{
                      width: 58, height: 64, flexShrink: 0, margin: 1,
                      background: highlight ? cat.color : cat.bg,
                      color: highlight ? '#fff' : cat.color,
                      border: `1px solid ${cat.color}40`,
                      borderRadius: 8,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: highlight ? `0 0 0 2px ${cat.color}` : undefined,
                      transition: 'all 0.15s',
                    }}
                    className="hover:opacity-80"
                  >
                    <span style={{ fontSize: 9, opacity: 0.8 }}>{el.number}</span>
                    <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{el.symbol}</span>
                    <span style={{ fontSize: 7, opacity: 0.8, maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.name}</span>
                    <span style={{ fontSize: 7, opacity: 0.7 }}>{el.mass}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {/* Row labels for lanthanides / actinides */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2" style={{ color: CATEGORIES['lanthanide'].color }}>* Lanthanides (57–71)</span>
            <span className="text-xs font-semibold px-2" style={{ color: CATEGORIES['actinide'].color }}>** Actinides (89–103)</span>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)' }} onClick={e => e.stopPropagation()}>
            {(() => {
              const cat = CATEGORIES[selected.category] ?? { color: '#64748b', bg: '#f1f5f9', label: selected.category };
              return (
                <>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0" style={{ background: cat.bg }}>
                      <span className="text-xs" style={{ color: cat.color }}>{selected.number}</span>
                      <span className="text-3xl font-black" style={{ color: cat.color }}>{selected.symbol}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h2>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Atomic Number', value: String(selected.number) },
                      { label: 'Atomic Mass', value: selected.mass },
                      { label: 'State at Room Temp', value: selected.state },
                      { label: 'Electron Config', value: selected.electronConfig },
                      { label: 'Group', value: selected.group ? String(selected.group) : 'f-block' },
                      { label: 'Period', value: String(selected.period <= 8 ? selected.period : selected.period === 9 ? 6 : 7) },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl p-3" style={{ background: 'var(--surface)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.label}</p>
                        <p className="font-semibold text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'var(--surface)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Discovered By</p>
                    <p className="font-semibold text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{selected.discoveredBy}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: cat.bg, color: cat.color }}>Close</button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
