export function setOpYear(year) {
	if (typeof window !== 'undefined' && year) {
		localStorage.setItem('opYear', year);
	}
}

export function getOpYear() {
	if (typeof window !== 'undefined') {
		return localStorage.getItem('opYear') || new Date().getFullYear(); // 기본값: 현재 연도
	}
}

export async function apiFetch(endpoint, options = {}) {
	const opYear = getOpYear();
	const backendURI = 'http://localhost:4000'
	const url = new URL(backendURI + endpoint, window.location.origin);

	// 기존 URL에 `opYear` 추가
	url.searchParams.append('opYear', opYear);

	return fetch(url.toString(), options);
}
