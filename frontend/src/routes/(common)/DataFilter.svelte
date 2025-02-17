<script>
	import { createEventDispatcher } from 'svelte';
	import _ from 'lodash';

	export let subjects = []; // 외부에서 전달받는 과목 데이터
	export let selectedSubject = "전체"; // 선택된 과목
	export let textFilter = ""; // 텍스트 필터
	export let startDate; // 시작 날짜
	export let endDate; // 종료 날짜
	export let allDates = false; // 모든 날짜 선택 여부
	export let minDate; // 날짜 필터 최소값
	export let maxDate; // 날짜 필터 최대값
	export let nameField;
	export let total;

	const dispatch = createEventDispatcher();

	// 필터 변경 시 상위 컴포넌트로 이벤트 전달
	function notifyFiltersChanged() {
		dispatch('filtersChanged', {
			selectedSubject,
			textFilter,
			startDate,
			endDate,
			allDates,
		});
	}

	// 수입 조회 이벤트에 debounce 적용 (500ms)
	const handleNameSearchInput = _.debounce(() => {
		notifyFiltersChanged(); // debounce 후 notify 호출
	}, 500);

	// textFilter 변경 감지
	$: if (typeof window !== 'undefined' && textFilter) {
		// textFilter가 변경될 때 debounce된 함수를 호출
		handleNameSearchInput();
	}
</script>

<div class="mb-4 flex items-center gap-4 text-xl">
	<!-- 과목 선택 -->
	<div>
		<label for="subjectSelect" class="mr-2 font-bold">과목:</label>
		<select
			id="subjectSelect"
			bind:value={selectedSubject}
			class="select select-bordered w-48 text-xl"
			on:change={notifyFiltersChanged}
		>
			<option value="전체">전체</option>
			{#each subjects as subject}
				<option value={subject}>{subject}</option>
			{/each}
		</select>
	</div>

	<!-- 텍스트 필터 -->
	<div class="flex items-center gap-2">
		<label class="mr-2 font-bold">검색:</label>
		<input
			type="text"
			bind:value={textFilter}
			placeholder={nameField + " 입력"}
			class="input input-bordered h-12 w-48 text-xl"
		/>
	</div>

	<!-- 날짜 필터 -->
	<div class="flex items-center">
		<label class="mr-2 font-bold text-xl">기간:</label>
		<input
			type="date"
			bind:value={startDate}
			min={minDate}
			max={maxDate}
			class="input input-bordered h-12 w-44"
			on:change={notifyFiltersChanged}
		/>
		~
		<input
			type="date"
			bind:value={endDate}
			min={minDate}
			max={maxDate}
			class="input input-bordered ml-2 h-12 w-44"
			on:change={notifyFiltersChanged}
		/>
	</div>

	<!-- 모든 날짜 검색 -->
	<div class="ml-2 flex items-center gap-1">
		<input
			type="checkbox"
			bind:checked={allDates}
			class="checkbox-primary checkbox mr-2"
			on:change={notifyFiltersChanged}
		/>
		<span class="text-center">모든 날짜 검색</span>
	</div>

	<div class="flex items-center">
		<input
			type="checkbox"
			bind:checked={total}
			class="checkbox-primary checkbox mr-2"
		/>
		<span class="text-center text-xl">합계</span>
	</div>
</div>
