<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { apiFetch } from '$lib/utils/opYearStorage.js';
	import { selectedYear, updateYear } from '$lib/stores/stores.js';
	import DataFilterHeader from '../(common)/DataFilterHeader.svelte';
	import TrashIcon from '../(common)/TrashIcon.svelte';

	let year;
	selectedYear.subscribe((value) => (year = value));

	// 반응형 스토어 사용
	export let budgetData = writable([]);
	export let accounts = writable([]);
	export let selectedAccount = writable(null);
	export let selectedSubjectType = writable('수입');
	export let subjectSortOption = writable('번호');

	let inputAccountName = ''; // 계정 이름 입력
	let inputSubject = ''; // 과목 이름 입력
	let inputOrder = ''; // 과목 번호 입력

	function handleYearChange(event) {
		updateYear(event.target.value);
		setOperationYear();
		fetchBudgetData();
	}

	// 데이터 조회
	async function fetchBudgetData() {
		const response = await apiFetch('/api/getBudgetData');
		budgetData.set(await response.json());

		categorizeData(); // 계정/과목 데이터 분류
	}

	// 계정 및 과목 데이터 분류
	function categorizeData() {
		const accountMap = {};
		$budgetData.forEach((item) => {
			if (!accountMap[item.계정]) {
				accountMap[item.계정] = {
					번호: item.번호,
					이름: item.계정,
					과목들: [],
				};
			}

			if (item.수입지출 === $selectedSubjectType) {
				accountMap[item.계정].과목들.push({
					id: item.id,
					번호: item.번호,
					이름: item.과목,
					수입지출: item.수입지출,
				});
			}
		});

		accounts.set([...Object.values(accountMap)]);
	}

	// 계정 조회
	async function fetchAccounts() {
		const response = await apiFetch('/api/getAccounts');
		accounts.set(await response.json());
	}

	// 계정 추가
	async function addAccount() {
		if (!inputAccountName.trim()) {
			alert('계정 이름을 입력하세요.');
			return;
		}

		const newAccount = { 계정: inputAccountName.trim() };

		try {
			const response = await apiFetch('/api/addAccount', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newAccount),
			});

			if (response.ok) {
				await fetchAccounts(); // 계정 목록 갱신
				const addedAccount = accounts.find((account) => account.이름 === inputAccountName.trim());
				selectedAccount = addedAccount || null; // 방금 추가한 계정을 선택
			} else {
				const error = await response.json();
				alert(`계정 추가 실패: ${error.message}`);
			}
		} catch (error) {
			console.error('계정 추가 오류:', error);
		} finally {
			inputAccountName = ''; // 입력 필드 초기화
			await fetchBudgetData(); // 전체 데이터 갱신
		}
	}

	// 계정 삭제
	async function deleteAccount(accountName) {
		if (!confirm('이 계정을 삭제하면 하위 모든 과목도 삭제됩니다. 계속하시겠습니까?')) {
			return;
		}

		try {
			const response = await apiFetch(`/api/deleteBudgetData?accountName=${accountName}`, {
				method: 'DELETE',
			});

			if (response.ok) {
				// 계정 목록 갱신
				await fetchAccounts();
				accounts = [...accounts]; // 반응성 강제
				selectedAccount = null; // 선택 초기화
			} else {
				const error = await response.json();
				alert(`계정 삭제 실패: ${error.message}`);
			}
		} catch (error) {
			console.error('계정 삭제 오류:', error);
		} finally {
			// 입력 필드 초기화 및 반응성 보장
			inputAccountName = '';
			inputAccountName = ''; // 반응성을 강제

			// 전체 데이터 갱신
			await fetchBudgetData();
			accounts = [...accounts]; // 반응성 강제
		}
	}

	// 과목 추가
	async function addSubject() {
		// 필수 입력값 검증
		if (!$selectedAccount || !inputOrder.trim() || !$selectedSubjectType || !inputSubject.trim()) {
			alert('모든 필드를 입력하세요.');
			return;
		}

		const newSubject = {
			계정: $selectedAccount.이름, // 반응형 스토어 값 사용
			번호: inputOrder.trim(),
			수입지출: $selectedSubjectType,
			과목: inputSubject.trim(),
		};

		try {
			const response = await apiFetch('/api/addSubject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newSubject),
			});

			if (response.ok) {
				await fetchBudgetData(); // 전체 데이터 갱신

				// 선택한 계정 반응성 유지
				selectedAccount.update(account => {
					if (!account || account.이름 !== newSubject.계정) return account;

					return {
						...account,
						과목들: [
							...account.과목들,
							{
								id: Date.now(), // 서버에서 ID 응답을 받지 못하는 경우 임시 ID
								번호: newSubject.번호,
								이름: newSubject.과목,
								수입지출: newSubject.수입지출,
							}
						]
					};
				});

				resetSubjectForm(); // 입력 필드 초기화
			} else {
				const error = await response.json();
				alert(`과목 추가 실패: ${error.message}`);
			}
		} catch (error) {
			console.error('과목 추가 오류:', error);
		}
	}

	// 과목 삭제
	async function deleteSubject(subjectId) {
		if (!confirm('이 과목을 삭제하시겠습니까?')) {
			return;
		}

		try {
			const response = await apiFetch(`/api/deleteBudgetData?subjectId=${subjectId}`, {
				method: 'DELETE',
			});

			if (response.ok) {
				await fetchBudgetData(); // 데이터 갱신

				// 선택된 계정의 최신 데이터를 유지
				selectedAccount.update(account => {
					if (!account) return null;

					// 필터링된 과목 목록 생성 (삭제된 과목 제외)
					const filteredSubjects = account.과목들.filter(subject => subject.id !== subjectId);

					return {
						...account,
						과목들: filteredSubjects,
					};
				});
			} else {
				const error = await response.json();
				alert(`과목 삭제 실패: ${error.message}`);
			}
		} catch (error) {
			console.error('과목 삭제 오류:', error);
		}
	}

	function sortSubjects(option) {

		subjectSortOption.set(option); // 반응형 업데이트

		selectedAccount.update(account => {
			if (!account) return null;

			const sortedSubjects = [...account.과목들].sort((a, b) => {
				if (option === '번호') return a.번호 - b.번호;
				if (option === '이름') return a.이름.localeCompare(b.이름);
			});

			return {
				...account,
				과목들: sortedSubjects
			};
		});
	}

	// 수입/지출 필터 변경
	function handleSubjectTypeChange(event) {
		// 선택된 값 가져오기
		const type = event.target.value;

		// 반응형 스토어에 값 업데이트
		selectedSubjectType.set(type);

		// 반응형 스토어를 사용하여 데이터 필터링
		selectedAccount.update((account) => {
			if (!account) return null; // 계정이 선택되지 않은 경우 처리

			// 새로운 과목 필터링 적용
			const filteredSubjects = $budgetData
				.filter((item) => item.계정 === account.이름 && item.수입지출 === type)
				.map((item) => ({
					id: item.id,
					번호: item.번호,
					이름: item.과목,
					수입지출: item.수입지출,
				}));

			// 기존 계정 정보 유지 + 새로운 과목 적용
			return {
				...account,
				과목들: filteredSubjects,
			};
		});
	}

	// 입력 필드 초기화
	function resetSubjectForm() {
		inputSubject = '';
		inputOrder = '';
	}

	// 계정 선택 시 반응성 유지
	function selectAccount(account) {
		selectedAccount.set(account);
	}

	function setOperationYear() {
		requestAnimationFrame(() => {
			const yearSelect = document.getElementById('yearSelect');
			if (yearSelect) {
				yearSelect.value = $selectedYear;
			}
		});
	}

	onMount(() => {
		fetchBudgetData();
		setOperationYear();
	});

</script>

<div class="p-4">
	<DataFilterHeader
		title="계정 및 과목 관리"
		bind:selectedYear={year}
		onYearChange={handleYearChange}
	/>

	<div class="flex gap-8">
		<!-- 계정 관리 -->
		<div class="w-1/2 flex flex-col items-center">
			<!-- 제목 중앙 정렬 -->
			<h3 class="text-2xl font-bold mb-2 w-full text-center">계정 관리</h3>

			<!-- 입력 필드 중앙 정렬 -->
			<div class="mb-4 flex items-center justify-center gap-2">
				<input type="text" bind:value={inputAccountName} placeholder="계정 이름" class="text-xl input input-bordered" />
				<button on:click={addAccount} class="btn btn-primary">추가</button>
			</div>

			<!-- 테이블을 중앙 정렬하고, 크기를 조정 -->
			<div class="w-full flex justify-center">
				<table class="table w-3/4 text-center">
					<thead>
					<tr class="text-2xl">
						<th class="text-center">이름</th>
						<th class="text-center">삭제</th>
					</tr>
					</thead>
					<tbody>
					{#each $accounts as account}
						<tr
							class="text-xl {$selectedAccount?.이름 === account.이름 ? 'bg-gray-200' : ''}"
							on:click={() => selectAccount(account)}
							style="cursor: pointer;"
						>
							<td>{account.이름}</td>
							<td>
								<button on:click={() => deleteAccount(account.이름)} class="hover:bg-red-200 rounded transition-colors duration-300 ease-in-out">
									<TrashIcon />
								</button>
							</td>
						</tr>
					{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- 과목 관리 -->
		<div class="w-1/2 text-center">
			<h3 class="text-2xl font-bold mb-2">
				과목 관리 {#if $selectedAccount} - {$selectedAccount.이름}{/if}
			</h3>
			{#if $selectedAccount}
				<!-- 입력 필드 중앙 정렬 -->
				<div class="mb-4 flex items-center justify-center gap-2">
					<input type="text" bind:value={inputOrder} placeholder="번호" class="input input-bordered w-20" />
					<select bind:value={$selectedSubjectType} on:change={handleSubjectTypeChange}
									class="select select-bordered w-32">
						<option value="수입">수입</option>
						<option value="지출">지출</option>
					</select>
					<input type="text" bind:value={inputSubject} placeholder="과목 이름" class="input input-bordered" />
					<button on:click={addSubject} class="btn btn-primary">추가</button>
				</div>

				<!-- 정렬 버튼 가운데 정렬 -->
				<div class="mb-4 flex justify-center gap-4">
					<label class="flex items-center">
						<input type="radio" name="subjectSort" value="번호"
									 bind:group={$subjectSortOption}
									 on:change={() => sortSubjects('번호')} />
						<span class="ml-2">번호순</span>
					</label>
					<label class="flex items-center">
						<input type="radio" name="subjectSort" value="이름"
									 bind:group={$subjectSortOption}
									 on:change={() => sortSubjects('이름')} />
						<span class="ml-2">이름순</span>
					</label>
				</div>

				<table class="table w-full">
					<thead>
					<tr class="text-xl text-center">
						<th>번호</th>
						<th>과목</th>
						<th class="w-6">수입/지출</th>
						<th>삭제</th>
					</tr>
					</thead>
					<tbody>
					{#each $selectedAccount.과목들 as subject}
						<tr class="text-xl">
							<td class="text-center">{subject.번호}</td>
							<td class="text-center">{subject.이름}</td>
							<td class="text-center">{subject.수입지출}</td>
							<td class="text-center">
								<button on:click={() => deleteSubject(subject.id)} class="hover:bg-red-200 rounded transition-colors duration-300 ease-in-out">
									<TrashIcon />
								</button>
							</td>
						</tr>
					{/each}
					</tbody>
				</table>
			{:else}
				<p class="text-xl text-gray-500">계정을 선택하세요.</p>
			{/if}
		</div>
	</div>
</div>
