import type { DesignDocument, DesignLayer } from './types'

export const sampleDocument: DesignDocument = {
  width: 1080,
  height: 1350,
  unit: 'px',
  dpi: 72,
  background: '#F4EEE4',
  presetName: 'Instagram portrait',
}

export const sampleLayers: DesignLayer[] = [
  {
    id: 'coral-orbit', name: 'Coral orbit', type: 'ellipse', x: 676, y: 82, width: 275, height: 275,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#FF5C47', stroke: '#FF5C47', strokeWidth: 0,
  },
  {
    id: 'photo', name: 'Chrome chair', type: 'image', x: 505, y: 172, width: 485, height: 625,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#E8A17E', stroke: '#111111', strokeWidth: 0, radius: 0,
    src: '/editorial-chair.jpg',
  },
  {
    id: 'blue-field', name: 'Cobalt field', type: 'rectangle', x: 0, y: 926, width: 1080, height: 424,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#173ED1', stroke: '#173ED1', strokeWidth: 0, radius: 0,
  },
  {
    id: 'side-rule', name: 'Side rule', type: 'rectangle', x: 70, y: 65, width: 13, height: 166,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#FF5C47', stroke: '#FF5C47', strokeWidth: 0, radius: 0,
  },
  {
    id: 'kicker', name: 'Collection label', type: 'text', x: 105, y: 70, width: 410, height: 36,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#151515', stroke: '#151515', strokeWidth: 0,
    text: 'A STUDY IN EVERYDAY FORM', fontSize: 24, fontWeight: 600, fontFamily: 'Inter', letterSpacing: 3.1, lineHeight: 1.2,
  },
  {
    id: 'edition', name: 'Edition', type: 'text', x: 105, y: 117, width: 250, height: 28,
    rotation: 0, opacity: 0.58, visible: true, locked: false, fill: '#151515', stroke: '#151515', strokeWidth: 0,
    text: 'EDITION 04  —  2026', fontSize: 18, fontWeight: 500, fontFamily: 'Inter', letterSpacing: 1.7, lineHeight: 1.2,
  },
  {
    id: 'objects-title', name: 'Objects', type: 'text', x: 68, y: 300, width: 778, height: 148,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#131315', stroke: '#131315', strokeWidth: 0,
    text: 'OBJECTS', fontSize: 140, fontWeight: 700, fontFamily: 'Inter', letterSpacing: -6.5, lineHeight: 0.95,
  },
  {
    id: 'living-title', name: 'For living', type: 'text', x: 68, y: 430, width: 844, height: 132,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#131315', stroke: '#131315', strokeWidth: 0,
    text: 'FOR LIVING', fontSize: 126, fontWeight: 700, fontFamily: 'Inter', letterSpacing: -6, lineHeight: 0.95,
  },
  {
    id: 'caption', name: 'Introduction', type: 'text', x: 72, y: 664, width: 340, height: 115,
    rotation: 0, opacity: 0.78, visible: true, locked: false, fill: '#131315', stroke: '#131315', strokeWidth: 0,
    text: 'Quiet geometry, honest materials,\nand the spaces we make our own.', fontSize: 24, fontWeight: 500, fontFamily: 'Inter', letterSpacing: -0.2, lineHeight: 1.45,
  },
  {
    id: 'issue-number', name: 'Issue number', type: 'text', x: 720, y: 929, width: 310, height: 286,
    rotation: 0, opacity: 0.14, visible: true, locked: false, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 0,
    text: '04', fontSize: 300, fontWeight: 700, fontFamily: 'Inter', letterSpacing: -16, lineHeight: 1,
  },
  {
    id: 'blue-copy', name: 'Feature copy', type: 'text', x: 72, y: 1010, width: 455, height: 88,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 0,
    text: 'A collection of considered pieces\nfor a more expressive home.', fontSize: 29, fontWeight: 500, fontFamily: 'Inter', letterSpacing: -0.4, lineHeight: 1.35,
  },
  {
    id: 'footer-rule', name: 'Footer rule', type: 'line', x: 72, y: 1198, width: 936, height: 0,
    rotation: 0, opacity: 0.7, visible: true, locked: false, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2,
  },
  {
    id: 'footer', name: 'Studio footer', type: 'text', x: 72, y: 1240, width: 760, height: 35,
    rotation: 0, opacity: 0.9, visible: true, locked: false, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 0,
    text: 'NORTHLINE STUDIO     LAGOS — LONDON', fontSize: 20, fontWeight: 600, fontFamily: 'Inter', letterSpacing: 2.2, lineHeight: 1.2,
  },
]

export const emptyDocumentLayers = (): DesignLayer[] => []

export const presets = [
  { id: 'instagram-post', name: 'Instagram post', category: 'Social', width: 1080, height: 1080, unit: 'px' as const, icon: 'instagram' },
  { id: 'instagram-portrait', name: 'Instagram portrait', category: 'Social', width: 1080, height: 1350, unit: 'px' as const, icon: 'portrait' },
  { id: 'story', name: 'Story or reel', category: 'Social', width: 1080, height: 1920, unit: 'px' as const, icon: 'phone' },
  { id: 'youtube', name: 'YouTube thumbnail', category: 'Social', width: 1280, height: 720, unit: 'px' as const, icon: 'landscape' },
  { id: 'a4', name: 'A4 document', category: 'Print', width: 210, height: 297, unit: 'mm' as const, icon: 'document' },
  { id: 'a3', name: 'A3 poster', category: 'Print', width: 297, height: 420, unit: 'mm' as const, icon: 'poster' },
  { id: 'web-banner', name: 'Web banner', category: 'Web', width: 1920, height: 600, unit: 'px' as const, icon: 'banner' },
  { id: 'desktop', name: 'Desktop frame', category: 'Web', width: 1440, height: 1024, unit: 'px' as const, icon: 'desktop' },
]
