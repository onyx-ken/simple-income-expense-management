<script>
	import { accountsStore, accountsLoading } from '$lib/stores/accounts.js';

	export let selectedAccount; // 선택된 계정
	export let onAccountChange; // 계정 변경 핸들러
	export let skeletonCount = 10; // 로딩 중 표시할 스켈레톤 개수

	let accounts = []; // 계정 리스트
	let loading = true; // 로딩 상태

	// 스토어 구독
	$: accounts = $accountsStore;
	$: loading = $accountsLoading;

</script>

<div class="mb-4 flex items-center gap-2">
	<!-- 전체 옵션 -->
	<label class="flex items-center">
		<input
			type="radio"
			name="account"
			value="전체"
			bind:group={selectedAccount}
			class="radio-primary radio mr-2"
			on:change={onAccountChange}
		/>
		전체
	</label>
	<!-- 계정 리스트 -->
	{#if loading}
		<!-- 로딩 중 스켈레톤 -->
		{#each Array(skeletonCount) as _}
			<label class="flex items-center">
				<div type="radio" class="skeleton h-2 w-2 shrink-0 rounded-full" />
			</label>
		{/each}
	{:else if accounts.length > 0}
		{#each accounts as account}
			<label class="flex items-center">
				<input
					type="radio"
					name="account"
					value={account.계정}
					class="radio-primary radio mr-2"
					bind:group={selectedAccount}
					on:change={onAccountChange}
				/>
				{account.계정}
			</label>
		{/each}
	{:else}
		<!-- 계정이 없을 때 -->
		<div class="text-gray-500">등록된 계정이 없습니다.</div>
	{/if}
</div>
