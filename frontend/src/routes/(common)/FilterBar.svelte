<script>
	export let account;
	export let startDate;
	export let endDate;
	export let allDates;
	export let subject;
	export let subjects; // 과목 리스트
	export let onFilterChange;

	function handleInputChange() {
		onFilterChange();
	}
</script>

<div class="mb-4 flex items-center gap-4">
	<!-- 계정 선택 -->
	<div class="flex items-center gap-2">
		<label>
			<input
				type="radio"
				name="account"
				value="전체"
				bind:group={account}
				on:change={handleInputChange}
				class="radio-primary radio mr-2"
			/>
			전체
		</label>
		<label>
			<input
				type="radio"
				name="account"
				value="일반"
				bind:group={account}
				on:change={handleInputChange}
				class="radio-primary radio mr-2"
			/>
			일반
		</label>
		<label>
			<input
				type="radio"
				name="account"
				value="건축"
				bind:group={account}
				on:change={handleInputChange}
				class="radio-primary radio mr-2"
			/>
			건축
		</label>
	</div>

	<!-- 과목 선택 -->
	<select
		bind:value={subject}
		on:change={handleInputChange}
		class="select select-bordered h-12 w-48"
	>
		<option value="전체">전체</option>
		{#each subjects || [] as subj}
			<option value={subj}>{subj}</option>
		{/each}
	</select>

	<!-- 날짜 필터 -->
	<div class="flex items-center">
		<label class="mr-2 font-bold">기간:</label>
		<input
			type="date"
			bind:value={startDate}
			on:change={handleInputChange}
			class="input input-bordered h-12"
		/>
		~
		<input
			type="date"
			bind:value={endDate}
			on:change={handleInputChange}
			class="input input-bordered ml-2 h-12"
		/>
	</div>

	<!-- 모든 날짜 검색 -->
	<div class="flex items-center">
		<input
			type="checkbox"
			bind:checked={allDates}
			on:change={handleInputChange}
			class="checkbox-primary checkbox mr-2"
		/>
		<span>모든 날짜 검색</span>
	</div>
</div>
