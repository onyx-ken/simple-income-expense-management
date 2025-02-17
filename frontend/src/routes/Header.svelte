<script>
	export let title; // 페이지 제목
	export let leftButtons = []; // 왼쪽 버튼 목록
	export let rightButtons = []; // 오른쪽 버튼 목록
</script>

<div
	class="relative mb-4 flex min-h-[80px] items-center justify-between rounded bg-gray-50 p-4 shadow"
>
	<!-- 왼쪽 버튼 -->
	<div class="flex gap-2">
		{#each leftButtons as button (button.label)}
			<button class={`${button.class} block rounded-md px-4 py-2`} on:click={button.onClick}>
				{button.label}
			</button>
		{/each}
	</div>

	<!-- 타이틀 -->
	<h1 class="pointer-events-none absolute inset-x-0 z-0 text-center text-4xl font-bold leading-none">
		{title}
	</h1>

	<!-- 오른쪽 버튼 -->
	<div class="z-10 flex gap-2">
		{#each rightButtons as button (button.label)}
			<button class={`${button.class} block rounded-md px-4 py-2`} on:click={button.onClick}>
				{button.label}
			</button>
		{/each}
	</div>
</div>
