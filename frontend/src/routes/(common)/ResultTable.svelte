<script>
	import { apiFetch } from '$lib/utils/opYearStorage.js';
	import { formatDate } from '$lib/utils/date.js'
	import { onDestroy, onMount } from 'svelte';
	import TrashIcon from './TrashIcon.svelte';

	export let fetchedData = []; // 외부에서 주입받는 데이터
	export let onUpdate; // 수정 완료 핸들러
	export let onDelete; // 삭제 핸들러
	export let typeValue;
	export let fieldName;
	export let textColor;

	let editingRow = null; // 현재 수정 중인 행 ID
	let editedData = {}; // 수정 중인 데이터
	let editedSubjects = []; // 수정 중인 행의 과목 데이터

	// 선택된 계정의 과목 데이터 가져오기
	async function fetchSubjectsByAccount(accountName) {
		if (accountName === '전체' || !accountName) {
			return []; // 전체 선택 시 빈 배열 반환
		}

		let response = await apiFetch(`/api/getSubjectsByAccount?account=${encodeURIComponent(accountName)}&typeValue=${encodeURIComponent(typeValue)}`);

		if (response.ok) {
			return await response.json();
		} else {
			alert('과목 데이터를 가져오는 중 오류가 발생했습니다')
		}
	}

	// 수정 모드 진입
	function enterEditMode(row) {
		editingRow = row.id;
		editedData = { ...row };

		// 날짜 형식을 YYYY-MM-DD로 변환
		const date = new Date(row.날짜);
		editedData.날짜 = date.toISOString().slice(0, 10);

		// 과목 데이터를 로드 (필요한 경우 서버 호출)
		loadSubjectsForRow(row.계정);
	}

	// 과목 데이터 로드
	async function loadSubjectsForRow(account) {
		// 서버 호출 로직 (사용자가 제공한 fetchSubjectsByAccount 사용)
		editedSubjects = await fetchSubjectsByAccount(account);
	}

	// 수정 취소
	function cancelEdit() {
		editingRow = null;
		editedData = {};
	}

	// 수정 완료
	function updateRow() {
		if (onUpdate) {
			onUpdate(editingRow, editedData);
		}
		editingRow = null;
		editedData = {};
	}

	// 삭제
	function deleteRow(rowId) {
		if (onDelete) {
			onDelete(rowId);
		}
	}

	// 수정 모드 키 이벤트 처리
	function handleEditKeydown(event) {
		if (event.key === 'Enter') {
			// Enter 키로 수정 확정
			updateRow();
		} else if (event.key === 'Escape') {
			// ESC 키로 수정 취소
			cancelEdit();
		}
	}

	// 수정 모드 외부 클릭 취소
	onMount(() => {
		function handleClickOutside(event) {
			if (editingRow) {
				const table = document.querySelector('table');
				if (!table.contains(event.target)) {
					cancelEdit();
				}
			}
		}

		document.addEventListener('click', handleClickOutside);

		onDestroy(() => {
			document.removeEventListener('click', handleClickOutside);
		});
	});

	// 데이터 변경 핸들러
	function updateEditedData(key, value) {
		editedData = { ...editedData, [key]: value };
	}


</script>

<table class="table table-zebra table-pin-rows table-fixed w-full">
	<thead>
	<tr class="text-2xl text-black">
		<th class="w-20">#</th>
		<th class="w-24">날짜</th>
		<th class="w-24">계정</th>
		<th class="w-52">과목</th>
		<th class="w-96">{fieldName}</th>
		<th class="w-36">금액</th>
		<th class="text-center w-20">삭제</th>
	</tr>
	</thead>
	<tbody>
	{#each fetchedData as row, index}
		<tr class="text-2xl">
			<!-- ID와 날짜 -->
			{#if editingRow === row.id}
				<td colspan="2">
					<input
						type="date"
						bind:value={editedData.날짜}
						class="input input-bordered w-full"
					/>
				</td>
			{:else}
				<td>{index + 1}</td>
				<td on:dblclick={() => enterEditMode(row)}>
					{formatDate(row.날짜)}
				</td>
			{/if}

			<!-- 계정 -->
			<td>{row.계정}</td>

			<!-- 과목 -->
			<td>
				{#if editingRow === row.id}
					<select
						bind:value={editedData.과목}
						class="select select-bordered w-full"
					>
						{#each editedSubjects as subject}
							<option value={subject}>{subject}</option>
						{/each}
					</select>
				{:else}
						<span on:dblclick={() => enterEditMode(row)}>
							{row.과목}
						</span>
				{/if}
			</td>

			<!-- 필드명 -->
			<td>
				{#if editingRow === row.id}
					<input
						type="text"
						value={editedData[fieldName]}
						on:input={(e) => updateEditedData(fieldName, e.target.value)}
						class="input input-bordered w-full"
						on:keydown={handleEditKeydown}
					/>
				{:else}
					<span on:dblclick={() => enterEditMode(row)}>
						{row[fieldName]}
					</span>
				{/if}
			</td>

			<!-- 금액 -->
			<td class={textColor}>
				{#if editingRow === row.id}
					<input
						type="text"
						bind:value={editedData.금액}
						class="input input-bordered w-full"
						on:keydown={handleEditKeydown}
					/>
				{:else}
					<span on:dblclick={() => enterEditMode(row)}>
						{row.금액.toLocaleString('ko-KR')}
					</span>
				{/if}
			</td>

			<!-- 작업 -->
			<td class="text-center">
				{#if editingRow === row.id}
					<div class="flex justify-center gap-2">
						<button
							class="btn btn-sm rounded-md bg-blue-600 hover:bg-blue-500 text-white text-outline-thin"
							on:click={updateRow}
						>
							수정
						</button>
						<button
							class="btn btn-sm rounded-md bg-red-600 hover:bg-red-500 text-white text-outline-thin"
							on:click={cancelEdit}
						>
							취소
						</button>
					</div>
				{:else}
					<button on:click={() => deleteRow(row.id)} class="hover:bg-red-200 rounded transition-colors duration-300 ease-in-out">
						<TrashIcon />
					</button>
				{/if}
			</td>
		</tr>
	{/each}
	</tbody>
</table>
