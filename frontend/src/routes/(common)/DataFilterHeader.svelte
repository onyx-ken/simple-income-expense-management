<script>
	export let title = "제목"; // 기본 제목
	export let dataCount = 0; // 데이터 개수
	export let selectedYear = new Date().getFullYear(); // 선택된 연도
	export let onYearChange; // 연도 변경 이벤트 핸들러
	export let textColor;

	const currentYear = new Date().getFullYear();
</script>

<div class="mb-4 flex items-center justify-between">
	<h2 class="flex items-center text-3xl font-bold">
		{title}
		{#if typeof textColor !== "undefined"}
			<span class="ml-2 text-xl {textColor}">(총: {dataCount}건)</span>
		{/if}
	</h2>
	<div class="flex items-center">
		<label for="yearSelect" class="mr-2 font-bold">작업 연도:</label>
		<select
			id="yearSelect"
			bind:value={selectedYear}
			class="select select-bordered"
			on:change={onYearChange}
		>
			{#each Array(5)
				.fill(0)
				.map((_, i) => currentYear + 1 - i) as year}
				<option value={year}>{year}</option>
			{/each}
		</select>
	</div>
</div>
