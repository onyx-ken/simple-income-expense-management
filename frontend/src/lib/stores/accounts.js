import { writable } from 'svelte/store';
import { apiFetch } from '$lib/utils/opYearStorage.js';

export const accountsStore = writable([]); // 계정 데이터
export const accountsLoading = writable(true); // 로딩 상태

// 계정 데이터를 가져오는 함수
export async function fetchAccounts() {
	accountsLoading.set(true); // 로딩 상태 설정
	try {
		const accounts = await apiFetch('/api/getAccounts');
		let promise = accounts.json();
		await promise
		accountsStore.set(await promise); // 가져온 데이터 저장
		console.log('fetchAccounts!');
		console.log(promise);
	} catch (error) {
		console.error('Failed to fetch accounts:', error);
		accountsStore.set([]); // 오류 시 빈 배열 설정
	} finally {
		accountsLoading.set(false); // 로딩 종료
	}
}
