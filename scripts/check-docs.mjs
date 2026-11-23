import { loadNavigation } from '../dist/vitepress.js';
import { fileURLToPath } from 'node:url';

const project = loadNavigation(fileURLToPath(new URL('../examples', import.meta.url)));
const diagrams = [...project.documents.values()].flatMap(document => document.diagrams);
console.log(`Checked ${project.documents.size} documents, ${diagrams.length} diagrams and ${diagrams.reduce((count, graph) => count + graph.steps.length, 0)} reading steps.`);
