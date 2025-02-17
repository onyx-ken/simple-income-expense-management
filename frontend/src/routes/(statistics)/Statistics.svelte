<script>
	import { onMount } from 'svelte';
	import StatisticsDataFilter from './StatisticsDataFilter.svelte';
	import StatSection from '../(common)/StatSection.svelte';
	import DataFilterHeader from '../(common)/DataFilterHeader.svelte';
	import { selectedYear, updateYear } from '$lib/stores/stores.js';
	import { apiFetch } from '$lib/utils/opYearStorage.js';

	let selectedType = '수입';
	let year;
	selectedYear.subscribe((value) => (year = value));

	// 날짜 필터 변수
	let startDate, endDate;
	const today = new Date();

	// '수입'용 기본 날짜: 현재 주의 월요일 ~ 일요일
	function getIncomeWeekRange(date) {
		const day = date.getDay(); // 0: 일, 1: 월, ... 6: 토
		const currentSunday = new Date(date);
		if (day !== 0) {
			currentSunday.setDate(date.getDate() + (7 - day));
		}
		const monday = new Date(currentSunday);
		monday.setDate(currentSunday.getDate() - 6);
		return { startDate: monday, endDate: currentSunday };
	}

	// '지출'용 기본 날짜: 일요일 ~ 이번 주의 토요일
	function getExpenseWeekRange(date) {
		// 현재 주의 일요일 (주: 일~토)
		const currSunday = new Date(date);
		currSunday.setDate(date.getDate() - date.getDay());
		// 이번 주 토요일
		const currSaturday = new Date(currSunday);
		currSaturday.setDate(currSunday.getDate() + 6);
		return { startDate: currSunday, endDate: currSaturday };
	}

	// 최초 '수입' 기본값 계산 및 저장
	const incomeRange = getIncomeWeekRange(today);
	const defaultIncomeStart = incomeRange.startDate.toISOString().slice(0, 10);
	const defaultIncomeEnd = incomeRange.endDate.toISOString().slice(0, 10);
	startDate = defaultIncomeStart;
	endDate = defaultIncomeEnd;

	function handleYearChange(event) {
		updateYear(event.target.value);
		startDate = `${$selectedYear}-01-01`;
		endDate = `${$selectedYear}-12-31`;
		setOperationYear();
		fetchSummary();
	}

	// 라디오 버튼 변경 시 처리 (수입/지출 전환)
	function handleRadioChange(event) {
		selectedType = event.detail.type;
		// '수입'의 기본값이 그대로인 경우에만 '지출' 변경 시 자동 조정
		if (
			selectedType === '지출' &&
			startDate === defaultIncomeStart &&
			endDate === defaultIncomeEnd
		) {
			const expenseRange = getExpenseWeekRange(today);
			startDate = expenseRange.startDate.toISOString().slice(0, 10);
			endDate = expenseRange.endDate.toISOString().slice(0, 10);
		}
		fetchSummary();
	}

	// 나머지 인쇄, 필터 복원 등 기존 코드 유지...
	let previousState = {}; // 이전 상태 저장

	function handlePrint() {
		const printable = document.getElementById('printable-area');
		if (!printable) {
			alert('인쇄할 결과가 없습니다.');
			console.error('Element with id "printable-area" not found.');
			return;
		}

		previousState = {
			selectedType,
			startDate,
			endDate,
		};

		const originalContents = document.body.innerHTML;
		document.body.innerHTML = printable.innerHTML;
		window.print();
		document.body.innerHTML = originalContents;
		restoreFilters();
		location.reload();
	}

	function restoreFilters() {
		if (previousState) {
			setRadioValue('account', previousState.selectedType);
			setDateValue('start-date', previousState.startDate);
			setDateValue('end-date', previousState.endDate);
			setOperationYear();
		}
	}

	function setRadioValue(name, value) {
		const radios = document.getElementsByName(name);
		for (const radio of radios) {
			if (radio.value === value) {
				radio.checked = true;
				const event = new Event('change');
				radio.dispatchEvent(event);
				break;
			}
		}
	}

	function setDateValue(id, value) {
		const dateInput = document.getElementById(id);
		if (dateInput) {
			dateInput.value = value;
			const event = new Event('change');
			dateInput.dispatchEvent(event);
		} else {
			console.error(`Element with id ${id} not found`);
		}
	}

	function setOperationYear() {
		requestAnimationFrame(() => {
			const yearSelect = document.getElementById('yearSelect');
			if (yearSelect) {
				yearSelect.value = $selectedYear;
			}
		});
	}

	let summary = { details: [], summary: { 수입: {}, 지출: {} } };
	let incomeData = {};
	let spendingData = {};
	let totalIncome = 0;
	let totalSpending = 0;
	let balance = 0;
	let previousBalance = 0;

	async function fetchSummary() {
		const response = await apiFetch(`/api/getSummary?start=${startDate}&end=${endDate}`);
		if (response.ok) {
			summary = await response.json();
			previousBalance = summary.previousBalance || 0;
		} else {
			summary = { details: [], summary: { 수입: {}, 지출: {} } };
			previousBalance = 0;
		}
	}

	function handleFiltersChanged(event) {
		startDate = event.detail.startDate;
		endDate = event.detail.endDate;
		fetchSummary();
	}

	onMount(async () => {
		await fetchSummary();
	});

	onMount(() => {
		setOperationYear();
	});

	$: if (summary.details.length > 0) {
		incomeData = summary.summary.수입;
		spendingData = summary.summary.지출;
		totalIncome = Object.values(incomeData).reduce((acc, account) => acc + account.total, 0);
		totalSpending = Object.values(spendingData).reduce((acc, account) => acc + account.total, 0);
		balance = previousBalance + totalIncome - totalSpending;
	}
</script>

<div class="relative p-4 scrollbar-always">
	<DataFilterHeader
		title="통계 조회"
		bind:selectedYear={year}
		onYearChange={handleYearChange}
	/>

	<StatisticsDataFilter
		statisticsType={selectedType}
		startDate={startDate}
		endDate={endDate}
		on:change={handleRadioChange}
		on:filtersChanged={handleFiltersChanged}
		on:print={handlePrint}
	/>

	{#if selectedType === '수입' & summary.details.length > 0}
		<!-- 수입 통계 -->
		<div id="printable-area" class="p-4 bg-gray-100 rounded print:bg-white print:p-0 print:gap-0 print:space-y-0">
			<h3 class="text-3xl text-center font-bold mb-4 print:text-xl print:mb-0">수입 통계</h3>
			<StatSection data={incomeData} textColor="blue"/>
			<div class="relative w-full h-16 border-t border-black bg-gray-100 mt-8 flex justify-between items-center px-8 print:bg-white print:mt-0 print:h-8 ">
				<!-- 이월금 -->
				<span class="font-bold text-2xl text-gray-700 print:text-black print:text-lg">
        	이월금: {previousBalance.toLocaleString("ko-KR")} 원
    		</span>

				<!-- 수입 합계 -->
				<span class="font-bold text-2xl text-blue-700 print:text-black print:text-lg">
				수입 합계: {totalIncome.toLocaleString("ko-KR")} 원
				</span>

				<!-- 지출 합계 -->
				<span class="font-bold text-2xl text-red-700 print:text-black print:text-lg">
				지출 합계: {totalSpending.toLocaleString("ko-KR")} 원
				</span>

				<!-- 잔액 -->
				<span class="font-bold text-2xl text-green-700 print:text-black print:text-lg">
				잔액: {balance.toLocaleString("ko-KR")} 원
				</span>
			</div>
		</div>

	{:else if selectedType === '지출' & summary.details.length > 0}
		<!-- 지출 통계 -->
		<div id="printable-area" class="p-4 bg-gray-100 rounded print:bg-white print:p-0 print:gap-0 print:space-y-0">
			<h3 class="text-3xl text-center font-bold mb-4 print:text-xl print:mb-0">지출 통계</h3>
			<StatSection data={spendingData} textColor="red"/>
			<div class="relative w-full h-16 border-t border-black bg-gray-100 mt-8 flex justify-between items-center px-8 print:bg-white print:mt-0 print:h-8 ">
				<!-- 이월금 -->
				<span class="font-bold text-2xl text-gray-700 print:text-black print:text-lg">
        	이월금: {previousBalance.toLocaleString("ko-KR")} 원
    		</span>

				<span class="font-bold text-2xl text-blue-700 print:text-black print:text-lg">
				지출 합계: {totalSpending.toLocaleString("ko-KR")} 원
				</span>

					<span class="font-bold text-2xl text-red-700 print:text-black print:text-lg">
				수입 합계: {totalIncome.toLocaleString("ko-KR")} 원
				</span>

					<span class="font-bold text-2xl text-green-700 print:text-black print:text-lg">
				잔액: {balance.toLocaleString("ko-KR")} 원
				</span>
			</div>
		</div>
	{/if}

</div>

<style>
    @media print {
        /* 전체 영역 설정 */
        #printable-area {
            max-width: 210mm; /* A4 용지 너비 */
            margin: 0 auto; /* 중앙 정렬 */
            padding: 0;
            overflow: hidden; /* 넘침 방지 */
            word-break: break-word; /* 단어 잘림 방지 */

        }

        /* 내부 텍스트 줄바꿈 및 간격 조정 */
        :global(.grid) {
            gap: 8px; /* 인쇄 시 간격 줄이기 */
        }
        :global(.flex) {
            display: flex;
            flex-wrap: wrap; /* 인쇄 시 요소가 잘리지 않도록 감싸기 */
            justify-content: space-between; /* 요소 정렬 */
        }

        /* 글꼴 크기와 간격 조정 */
        :global(h3, h4, h5) {
            font-size: 1rem; /* 제목 크기 축소 */
            margin: 4mm 0; /* 제목 간격 조정 */
        }

        :global(span, p) {
            font-size: 0.9rem; /* 본문 크기 축소 */
            line-height: 1.2; /* 줄 간격 조정 */
        }

        :global(html, body) {
						-webkit-print-color-adjust:exact;
						width: 210mm;
						height: 297mm;
            zoom:97%;
            transform-origin: top left; /* 축소 기준점 */
				}

        @page {
            margin: 2mm 5mm; /* 상하 10mm, 좌우 5mm */
            size: A4;
        }
    }

</style>
