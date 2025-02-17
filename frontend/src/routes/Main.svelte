<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { fetchAccounts } from '$lib/stores/accounts.js';
	import Income from './(income)/Income.svelte';
	import Spending from './(spending)/Spending.svelte';
	import Header from './Header.svelte';
	import Statistics from './(statistics)/Statistics.svelte';
	import AccountManager from './(accountManager)/AccountManager.svelte';

	let currentPage = writable('income');

	// 화면 전환 함수
	function showIncome() {
		currentPage.set('income');
	}

	function showSpending() {
		currentPage.set('spending');
	}

	function showStatistics() {
		currentPage.set('statistics')
	}

	function showManagement() {
		currentPage.set('management');
	}

	onMount(() => {
		fetchAccounts(); // 애플리케이션 로드 시 한 번만 호출
	});
</script>

<div class="p-4">
	<!-- 상단 설정 -->
	<Header
		title="수입 및 지출 관리"
		leftButtons={[
			{
				label: '계정 및 과목 관리',
				class: 'btn btn-sm btn-outline',
				onClick: showManagement
			}
		]}
		rightButtons={[
			{ label: '수입', class: 'btn bg-blue-600 hover:bg-blue-500 text-white text-outline-thin', onClick: showIncome },
			{ label: '지출', class: 'btn bg-red-600 hover:bg-red-500 text-white text-outline-thin', onClick: showSpending },
			{ label: '통계', class: 'btn bg-green-700 hover:bg-green-600 text-white text-outline-thin', onClick: showStatistics }
		]}
	/>

	<!-- 조회 화면 -->
	<div>
		{#if $currentPage === 'income'}
			<Income />
		{:else if $currentPage === 'spending'}
			<Spending />
		{:else if $currentPage === 'statistics'}
			<Statistics />
		{:else if $currentPage === 'management'}
			<AccountManager />
		{/if}
	</div>
</div>
