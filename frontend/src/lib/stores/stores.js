import { writable } from 'svelte/store';
import { getOpYear, setOpYear } from '$lib/utils/opYearStorage.js';

export const selectedYear = writable(getOpYear());

export function updateYear(year) {
	setOpYear(year);
	selectedYear.set(year);
}
