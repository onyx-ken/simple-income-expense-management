<script>
	export let data; // 수입 또는 지출 데이터
	export let textColor;
</script>

<div>
	{#each Object.entries(data) as [account, accountData]}
		<div class="mb-6 print:mb-1 print:space-y-1">
			<h4 class="flex justify-between text-2xl font-bold mb-2 print:text-sm print:mb-0">{account}</h4>

			{#each Object.entries(accountData.subjects) as [subject, subjectData]}
				<div class="mb-4 print:mb-2">
					<h5 class="text-xl border-t border-black font-semibold mb-2 print:text-sm print:mb-0">&lt;{subject}&gt;</h5>

					<div class="grid grid-cols-3 gap-x-4 gap-y-2 print:gap-x-0 print:gap-y-0 print:grid-cols-4">
						{#each subjectData.items as item}
							<div class="flex justify-between text-lg print:text-sm">
								<span>{item["항목"]}</span>
								<span class="text-{textColor}-700 print:text-black">
                  {item["금액"].toLocaleString("ko-KR")}
                </span>
							</div>
						{/each}
					</div>

					<p class="text-right font-bold text-lg mt-2 print:text-sm print:mt-0">
						소계: {subjectData.total.toLocaleString("ko-KR")}
					</p>
				</div>
			{/each}

			<p class="text-right font-bold text-xl text-green-700 print:text-black print:text-sm">
				계정 합계: {accountData.total.toLocaleString("ko-KR")}
			</p>
		</div>
	{/each}
</div>
