<script>
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/utils/opYearStorage.js';
	import { selectedYear, updateYear } from '$lib/stores/stores.js';
	import { writable } from 'svelte/store';

	import DataFilterHeader from '../(common)/DataFilterHeader.svelte';
	import AccountFilter from '../(common)/AccountFilter.svelte';
	import DataFilter from '../(common)/DataFilter.svelte';
	import DataInputSpendForm from './DataInputSpendForm.svelte';
	import ResultTable from '../(common)/ResultTable.svelte';
	import Total from '../(common)/Total.svelte';

	let year;
	selectedYear.subscribe((value) => (year = value));

	let spendingData = [];

	// 현재 연도
	let startDate, endDate;
	const today = new Date();

	let allDates = false; // "모든 날짜 검색" 체크박스 상태

	let summaryFilter = ''; // 적요 검색 필드 추가

	let total = false;

	function getWeekRange(date) {
		const day = date.getDay(); // 0: 일요일, 1: 월요일, ... 6: 토요일
		let previousSunday = new Date(date);

		if (day === 0) {
			// 오늘이 일요일인 경우, 아직 주가 끝나지 않았으므로 전 주의 일요일로 처리
			previousSunday.setDate(date.getDate() - 7);
		} else {
			previousSunday.setDate(date.getDate() - day);
		}

		const upcomingSaturday = new Date(previousSunday);
		upcomingSaturday.setDate(previousSunday.getDate() + 6);

		return { startDate: previousSunday, endDate: upcomingSaturday };
	}

	({ startDate, endDate } = getWeekRange(today));
	startDate = startDate.toISOString().slice(0, 10);
	endDate = endDate.toISOString().slice(0, 10);

	async function fetchSpendingData() {
		const params = new URLSearchParams({
			selectedAccount: selectedAccount,
			selectedSubject: selectedSubject,
			start: allDates ? '' : startDate,
			end: allDates ? '' : endDate,
			summary: summaryFilter.trim()
		});

		let response = await apiFetch(`/api/getSpendingData?${params}`);

		spendingData = await response.json();
	}

	// 데이터 수정 함수
	async function updateSpendingData(id, updatedData) {
		try {
			await apiFetch(`/api/updateSpendingData/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedData)
			});
			await fetchSpendingData(); // ✅ 수정 후 데이터 갱신
		} catch (error) {
			console.error('수정 오류:', error);
			alert('수정 중 오류가 발생했습니다.');
		}
	}

	function handleUpdate(id, updatedData) {
		updateSpendingData(id, updatedData)
	}

	async function deleteSpendingData(id) {
		if (!confirm('해당 데이터를 삭제하시겠습니까?')) {
			return;
		}

		try {
			await apiFetch(`/api/deleteSpendingData/${id}`, { method: 'DELETE' });
			await fetchSpendingData(); // ✅ 삭제 후 데이터 갱신
		} catch (error) {
			console.error('삭제 오류:', error);
			alert('데이터 삭제 중 오류가 발생했습니다.');
		}
	}

	function handleDelete(id) {
		deleteSpendingData(id);
	}

	// 데이터 초기화
	onMount(async () => {
		await fetchSpendingData();
		if (typeof window !== 'undefined' && selectedAccount) {
			await fetchSubjects();
		}
	});

	onMount(() => {
		setOperationYear();
	});

	function setOperationYear() {
		// 강제로 select box와 store의 값을 동기화
		requestAnimationFrame(() => {
			const yearSelect = document.getElementById('yearSelect');
			if (yearSelect) {
				yearSelect.value = $selectedYear; // 현재 스토어 값을 DOM에 반영
			}
		});
	}

	// 계정 선택 변경 시 과목 데이터 새로고침
	$: if (typeof window !== 'undefined' && selectedAccount) {
		fetchSubjects();
	}

	function handleYearChange(event) {
		updateYear(event.target.value);
		startDate = `${$selectedYear}-01-01`;
		endDate = `${$selectedYear}-12-31`;
		fetchSubjects();
		fetchSpendingData();
		setOperationYear();
	}

	// 선택된 계정의 과목 데이터 가져오기 (조회용)
	async function fetchSubjects() {
		const data = await fetchSubjectsByAccount(selectedAccount);
		subjects.set(data); // ✅ 반응형 업데이트
	}

	let selectedAccount = '전체';
	let selectedSubject = '전체';

	let subjects = writable([]);
	let typeValue = '지출';

	// 계정 변경 시 호출
	async function handleAccountChange() {
		const data = await fetchSubjectsByAccount(selectedAccount);
		subjects.set(data); // ✅ 반응형 스토어 업데이트
		selectedSubject = '전체'; // 계정 변경 시 과목 초기화

		// 데이터 갱신
		await fetchSpendingData();
	}

	// 선택된 계정의 과목 데이터 가져오기
	async function fetchSubjectsByAccount(accountName) {
		if (accountName === '전체' || !accountName) {
			return []; // 전체 선택 시 빈 배열 반환
		}

		try {
			let response = await apiFetch(`/api/getSubjectsByAccount?account=${encodeURIComponent(accountName)}&typeValue=${encodeURIComponent(typeValue)}`);

			if (response.ok) {
				let data = await response.json();
				return data; // ✅ subjects를 직접 변경하지 않고 반환
			} else {
				console.error('과목 데이터를 가져오는 중 오류 발생:', response.statusText);
				return [];
			}
		} catch (error) {
			console.error('과목 데이터를 가져오는 중 오류가 발생했습니다:', error);
			return [];
		}
	}

	function handleFiltersChanged(event) {
		// 상위 컴포넌트의 필터 상태 업데이트
		selectedSubject = event.detail.selectedSubject;
		summaryFilter = event.detail.textFilter;
		startDate = event.detail.startDate;
		endDate = event.detail.endDate;
		allDates = event.detail.allDates;

		// 데이터 갱신
		fetchSpendingData();
	}

	async function handleDataAdded() {
		await fetchSpendingData();
	}

</script>

<div class="p-4 scrollbar-always">
	<DataFilterHeader
		title="지출 조회"
		textColor="text-red-700"
		dataCount={spendingData.length}
		bind:selectedYear={year}
		onYearChange={handleYearChange}
	/>

	<!-- 계정 필터 -->
	<AccountFilter
		bind:selectedAccount
		onAccountChange={handleAccountChange}
	/>

	<!-- 데이터 필터 -->
	<DataFilter
		bind:subjects={$subjects}
		nameField="적요"
		selectedSubject={selectedSubject}
		textFilter={summaryFilter}
		startDate={startDate}
		endDate={endDate}
		allDates={allDates}
		on:filtersChanged={handleFiltersChanged}
		bind:total={total}
	/>

	<h2 class="mb-4 flex items-center text-3xl font-bold">지출 입력</h2>

	<!-- 지출 데이터 입력 -->
	<DataInputSpendForm
		{typeValue}
		on:dataAdded={handleDataAdded}
	/>

	<!-- 결과 테이블 -->
	<ResultTable
		fieldName='적요'
		textColor="text-red-700"
		fetchedData={spendingData}
		typeValue={typeValue}
		onUpdate={handleUpdate}
		onDelete={handleDelete}
	/>

	{#if total}
		<Total
			fetchedData={spendingData}
		/>
	{/if}
</div>
