<script>
	import { createEventDispatcher } from 'svelte';

	export let statisticsType;
	export let startDate; // 시작 날짜
	export let endDate; // 종료 날짜

	const dispatch = createEventDispatcher();

	// 선택된 라디오 버튼의 값을 변경
	function updateType(event) {
		statisticsType = event.target.value; // 선택된 값을 업데이트
		dispatch('change', { type: statisticsType }); // 상위 컴포넌트에 전달
	}

	// 필터 변경 시 상위 컴포넌트로 이벤트 전달
	function notifyFiltersChanged() {
		dispatch('filtersChanged', {
			startDate,
			endDate,
		});
	}

	function notifyPrint() {
		dispatch('print');
	}

</script>

<div class="mb-4 flex items-center gap-2">
	<label class="flex items-center">
		<input
			type="radio"
			name="account"
			value="수입"
			bind:group={statisticsType}
			class="radio-primary radio mr-2"
			on:change={updateType}
		/>
		수입
	</label>
	<label class="flex items-center">
		<input
			type="radio"
			name="account"
			value="지출"
			bind:group={statisticsType}
			class="radio-primary radio mr-2"
			on:change={updateType}
		/>
		지출
	</label>
	<!-- 날짜 필터 -->
	<div class="flex items-center mx-auto">
		<label class="mr-2 font-bold text-xl">기간:</label>
		<input
			id="start-date"
			type="date"
			class="input input-bordered h-12"
			bind:value={startDate}
			on:change={notifyFiltersChanged}
		/>
		~
		<input
			id="end-date"
			type="date"
			class="input input-bordered ml-2 h-12"
			bind:value={endDate}
			on:change={notifyFiltersChanged}
		/>
	</div>
	<button class="ml-auto mr-10" on:click={notifyPrint}>
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-8">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
		</svg>
	</button>
</div>
