<script>
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/utils/opYearStorage.js';
	import { selectedYear, updateYear } from '$lib/stores/stores.js';
	import { writable } from 'svelte/store';

	import DataFilterHeader from '../(common)/DataFilterHeader.svelte';
	import AccountFilter from '../(common)/AccountFilter.svelte';
	import DataFilter from '../(common)/DataFilter.svelte';
	import DataInputIncomeForm from './DataInputIncomeForm.svelte';
	import ResultTable from '../(common)/ResultTable.svelte';
	import Total from '../(common)/Total.svelte';

	let year;
	selectedYear.subscribe((value) => (year = value));

	let incomeData = [];

	// 현재 연도
	let startDate, endDate;
	const today = new Date();

	let allDates = false; // "모든 날짜 검색" 체크박스 상태

	let nameFilter = ''; // 이름 검색 필드 추가

	let total = false;

	function getWeekRange(date) {
		const day = date.getDay(); // 0: 일요일, 1: 월요일, ... 6: 토요일
		const currentSunday = new Date(date);
		if (day !== 0) {
			currentSunday.setDate(date.getDate() + (7 - day));
		}
		const monday = new Date(currentSunday);
		monday.setDate(currentSunday.getDate() - 6);
		return { startDate: monday, endDate: currentSunday };
	}

	({ startDate, endDate } = getWeekRange(today));
	startDate = startDate.toISOString().slice(0, 10);
	endDate = endDate.toISOString().slice(0, 10);

	async function fetchIncomeData() {
		const params = new URLSearchParams({
			selectedAccount,
			selectedSubject,
			start: allDates ? '' : startDate,
			end: allDates ? '' : endDate,
			name: nameFilter.trim()
		});

		let response = await apiFetch(`/api/getIncomeData?${params}`);

		incomeData = await response.json();
	}

	// 데이터 수정 함수
	async function updateIncomeData(id, updatedData) {
		try {
			await apiFetch(`/api/updateIncomeData/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedData)
			});

			// 수정 후 데이터 갱신
			await fetchIncomeData();
		} catch (error) {
			console.error('수정 오류:', error);
			alert('수정 중 오류가 발생했습니다.');
		}
	}

	function handleUpdate(id, updatedData) {
		updateIncomeData(id, updatedData)
	}

	async function deleteIncomeData(id) {
		if (!confirm('해당 데이터를 삭제하시겠습니까?')) {
			return;
		}

		try {
			await apiFetch(`/api/deleteIncomeData/${id}`, {
				method: 'DELETE'
			});

		} catch (error) {
			console.error('삭제 오류:', error);
			alert('데이터 삭제 중 오류가 발생했습니다.');
		} finally {
			await fetchIncomeData();
		}
	}

	function handleDelete(id) {
		deleteIncomeData(id);
	}

	// 데이터 초기화
	onMount(async () => {
		await fetchIncomeData();
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
		fetchIncomeData();
		setOperationYear();
	}

	// 선택된 계정의 과목 데이터 가져오기 (조회용)
	async function fetchSubjects() {
		const data = await fetchSubjectsByAccount(selectedAccount);
		subjects.set(data); // ✅ subjects를 반응형으로 설정
	}

	let selectedAccount = '전체'; // 선택된 계정
	let selectedSubject = '전체'; // 선택된 과목

	let subjects = writable([]); // 계정에 속한 과목 데이터
	let typeValue = '수입';

	// 계정 변경 시 호출
	async function handleAccountChange() {
		const data = await fetchSubjectsByAccount(selectedAccount);
		subjects.set(data); // ✅ 반응형 스토어 업데이트
		selectedSubject = '전체'; // 계정 변경 시 과목 초기화

		// 데이터 갱신
		await fetchIncomeData();
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
		nameFilter = event.detail.textFilter;
		startDate = event.detail.startDate;
		endDate = event.detail.endDate;
		allDates = event.detail.allDates;

		// 데이터 갱신
		fetchIncomeData();
	}

	async function handleDataAdded() {
		await fetchIncomeData();
	}

</script>

<div class="p-4 scrollbar-always">
	<DataFilterHeader
		title="수입 조회"
		textColor="text-blue-800"
		dataCount={incomeData.length}
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
		nameField="이름"
		selectedSubject={selectedSubject}
		textFilter={nameFilter}
		startDate={startDate}
		endDate={endDate}
		allDates={allDates}
		on:filtersChanged={handleFiltersChanged}
		bind:total={total}
	/>

	<h2 class="mb-4 flex items-center text-3xl font-bold">수입 입력</h2>

	<!-- 수입 데이터 입력 -->
	<DataInputIncomeForm
		{typeValue}
		on:dataAdded={handleDataAdded}
	/>

	<!-- 결과 테이블 -->
	<ResultTable
		fieldName='이름'
		textColor="text-blue-700"
		fetchedData={incomeData}
		typeValue={typeValue}
		onUpdate={handleUpdate}
		onDelete={handleDelete}
	/>

	{#if total}
		<Total
			fetchedData={incomeData}
		/>
	{/if}
</div>
