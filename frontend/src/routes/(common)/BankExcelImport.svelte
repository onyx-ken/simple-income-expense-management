<script>
	import { createEventDispatcher } from 'svelte';
	import { apiFetch } from '$lib/utils/opYearStorage.js';

	export let targetType = 'income';
	export let title = '통장 엑셀 자동입력';
	export let fieldLabel = '내용';
	export let textColor = 'text-slate-700';

	let file;
	let fileInput;
	let analyzing = false;
	let importing = false;
	let resultMessage = '';
	let accountNumber = '';
	let rows = [];
	let subjectsByAccount = {};

	const dispatch = createEventDispatcher();

	$: accountOptions = Object.keys(subjectsByAccount);
	$: selectedRows = rows.filter(row => row.selected && row.status !== 'skip');
	$: readyCount = rows.filter(row => row.status === 'ready').length;
	$: reviewCount = rows.filter(row => row.status === 'needs_review').length;
	$: skippedCount = rows.filter(row => row.status === 'skip').length;

	function readFileAsBase64(selectedFile) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = String(reader.result || '');
				resolve(dataUrl.split(',')[1] || '');
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(selectedFile);
		});
	}

	async function analyzeFile() {
		if (!file) {
			alert('엑셀 파일을 선택해 주세요.');
			return;
		}

		analyzing = true;
		resultMessage = '';
		rows = [];

		try {
			const fileBase64 = await readFileAsBase64(file);
			const response = await apiFetch('/api/parseBankExcel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileName: file.name,
					fileBase64,
					targetType
				})
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				throw new Error(error.message || '엑셀 분석에 실패했습니다.');
			}

			const data = await response.json();
			accountNumber = data.accountNumber || '';
			subjectsByAccount = data.subjectsByAccount || {};
			rows = (data.rows || []).map(row => ({
				...row,
				selected: row.status === 'ready'
			}));
			resultMessage = `${data.totalCount || 0}건을 읽었습니다. 입력 후보 ${data.importableCount || 0}건, 확인 필요 ${data.reviewCount || 0}건, 제외 ${data.skippedCount || 0}건입니다.`;
		} catch (error) {
			console.error('엑셀 분석 오류:', error);
			alert(error.message || '엑셀 파일을 분석하는 중 오류가 발생했습니다.');
		} finally {
			analyzing = false;
		}
	}

	async function importRows() {
		if (selectedRows.length === 0) {
			alert('입력할 거래를 선택해 주세요.');
			return;
		}

		if (!confirm(`${selectedRows.length}건을 입력할까요?`)) {
			return;
		}

		importing = true;

		try {
			const response = await apiFetch('/api/importBankExcelRows', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType,
					rows: selectedRows
				})
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				throw new Error(error.message || '일괄 입력에 실패했습니다.');
			}

			const data = await response.json();
			resultMessage = `${data.insertedCount || 0}건을 입력했습니다. ${data.skippedCount || 0}건은 중복 또는 오류로 제외했습니다.`;
			rows = rows.map(row => selectedRows.includes(row)
				? { ...row, selected: false, status: 'skip', reason: '입력 완료 또는 중복 확인됨' }
				: row
			);
			dispatch('dataImported', data);
		} catch (error) {
			console.error('일괄 입력 오류:', error);
			alert(error.message || '거래 내역을 입력하는 중 오류가 발생했습니다.');
		} finally {
			importing = false;
		}
	}

	function handleAccountChange(row) {
		const subjects = subjectsByAccount[row.account] || [];
		if (!subjects.includes(row.subject)) {
			row.subject = subjects[0] || '';
		}
		rows = rows;
	}

	function clearRows() {
		rows = [];
		file = undefined;
		accountNumber = '';
		resultMessage = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function statusLabel(status) {
		if (status === 'ready') return '입력 후보';
		if (status === 'needs_review') return '확인 필요';
		return '제외';
	}
</script>

<div class="mt-6 border-t border-gray-200 pt-4">
	<div class="mb-3 flex flex-wrap items-center gap-3">
		<h3 class={`text-xl font-bold ${textColor}`}>{title}</h3>
		<input
			bind:this={fileInput}
			type="file"
			accept=".xls,.xlsx"
			class="file-input file-input-bordered file-input-sm max-w-xs"
			on:change={(event) => file = event.currentTarget.files?.[0]}
		/>
		<button type="button" class="btn btn-primary btn-sm" disabled={analyzing} on:click={analyzeFile}>
			{analyzing ? '분석 중...' : '엑셀 분석'}
		</button>
		{#if rows.length > 0}
			<button type="button" class="btn btn-outline btn-sm" on:click={clearRows}>비우기</button>
		{/if}
	</div>

	{#if resultMessage}
		<div class="mb-3 text-sm text-gray-700">
			{#if accountNumber}
				<span class="mr-3 font-semibold">계좌 {accountNumber}</span>
			{/if}
			<span>{resultMessage}</span>
		</div>
	{/if}

	{#if rows.length > 0}
		<div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
			<span>입력 후보 {readyCount}건</span>
			<span>확인 필요 {reviewCount}건</span>
			<span>제외 {skippedCount}건</span>
			<span class="font-semibold">선택 {selectedRows.length}건</span>
			<button type="button" class="btn btn-success btn-sm" disabled={importing || selectedRows.length === 0} on:click={importRows}>
				{importing ? '입력 중...' : '선택 입력'}
			</button>
		</div>

		<div class="max-h-96 overflow-auto border border-gray-200">
			<table class="table table-sm">
				<thead class="sticky top-0 bg-white">
					<tr>
						<th>선택</th>
						<th>상태</th>
						<th>날짜</th>
						<th>계정</th>
						<th>과목</th>
						<th>{fieldLabel}</th>
						<th class="text-right">금액</th>
						<th>통장 내용</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr class:bg-gray-50={row.status === 'skip'} class:bg-yellow-50={row.status === 'needs_review'}>
							<td>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									bind:checked={row.selected}
									disabled={row.status === 'skip'}
								/>
							</td>
							<td>
								<div class="font-semibold">{statusLabel(row.status)}</div>
								{#if row.reason}
									<div class="max-w-44 text-xs text-gray-500">{row.reason}</div>
								{/if}
							</td>
							<td>
								<input type="date" class="input input-bordered input-sm w-36" bind:value={row.date} disabled={row.status === 'skip'} />
							</td>
							<td>
								<select class="select select-bordered select-sm w-28" bind:value={row.account} disabled={row.status === 'skip'} on:change={() => handleAccountChange(row)}>
									{#each accountOptions as account}
										<option value={account}>{account}</option>
									{/each}
								</select>
							</td>
							<td>
								<select class="select select-bordered select-sm w-44" bind:value={row.subject} disabled={row.status === 'skip'}>
									{#each subjectsByAccount[row.account] || [] as subject}
										<option value={subject}>{subject}</option>
									{/each}
								</select>
							</td>
							<td>
								<input type="text" class="input input-bordered input-sm w-56" bind:value={row.title} disabled={row.status === 'skip'} />
							</td>
							<td>
								<input type="number" min="1" class="input input-bordered input-sm w-32 text-right" bind:value={row.amount} disabled={row.status === 'skip'} />
							</td>
							<td>
								<div class="max-w-64 text-xs">
									<div>{row.raw?.record || row.raw?.content}</div>
									<div class="text-gray-500">{row.raw?.content} {row.raw?.memo}</div>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
