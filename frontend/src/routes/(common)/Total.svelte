<script>
	import { onMount } from 'svelte';

	export let fetchedData = []; // 외부에서 주입받는 데이터
	// 데이터 통계 계산
	let totals = {
		totalAmount: 0, // 전체 합계
		accounts: {}, // 계정별 합계
		subjects: {} // 과목별 합계
	};

	// 합계를 계산하는 함수
	function calculateTotals() {
		totals = {
			totalAmount: 0,
			accounts: {},
			subjects: {}
		};

		fetchedData.forEach(row => {
			const { 계정, 과목, 금액 } = row;

			// 전체 합계
			totals.totalAmount += 금액;

			// 계정별 합계
			if (!totals.accounts[계정]) {
				totals.accounts[계정] = 0;
			}
			totals.accounts[계정] += 금액;

			// 과목별 합계
			if (!totals.subjects[계정]) {
				totals.subjects[계정] = {};
			}
			if (!totals.subjects[계정][과목]) {
				totals.subjects[계정][과목] = 0;
			}
			totals.subjects[계정][과목] += 금액;
		});
	}

	$: {
		fetchedData = [...fetchedData];
		calculateTotals();
	}

	onMount(async () => {
		if (typeof window !== 'undefined' && fetchedData) {
			calculateTotals();
		}
	});
</script>

<div class="mt-8 bg-gray-100 p-4 rounded">
	<h3 class="text-3xl font-bold mb-4">합계</h3>

	<table class="table table-auto border-collapse w-full bg-white shadow-md rounded">
		<thead class="bg-gray-200 text-2xl">
		<tr class="text-left text-black">
			<th class="px-4 py-2 border text-center">분류</th>
			<th class="px-4 py-2 border text-center">세부 항목</th>
			<th class="px-4 py-2 border text-right">금액 (원)</th>
		</tr>
		</thead>
		<tbody class="text-xl text-center">
		<!-- 전체 합계 -->
		<tr>
			<td class="px-4 py-2 border font-bold">전체</td>
			<td class="px-4 py-2 border text-blue-800">합계</td>
			<td class="px-4 py-2 border text-right font-bold">
				{totals.totalAmount.toLocaleString('ko-KR')}
			</td>
		</tr>

		<!-- 계정별 합계 및 과목별 합계 -->
		{#each Object.entries(totals.accounts) as [account, amount]}
			<!-- 계정 합계 -->
			<tr>
				<td class="px-4 py-2 border font-bold">{account}</td>
				<td class="px-4 py-2 border text-blue-800">합계</td>
				<td class="px-4 py-2 border text-right">
					{amount.toLocaleString('ko-KR')}
				</td>
			</tr>

			<!-- 계정별 과목 합계 -->
			{#if totals.subjects[account]}
				{#each Object.entries(totals.subjects[account]) as [subject, amount]}
					<tr>
						<td class="px-4 py-2 border text-blue-800">{account}</td>
						<td class="px-4 py-2 border">{subject}</td>
						<td class="px-4 py-2 border text-right">
							{amount.toLocaleString('ko-KR')}
						</td>
					</tr>
				{/each}
			{/if}
		{/each}
		</tbody>
	</table>
</div>
