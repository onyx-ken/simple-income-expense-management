<script>
	import { apiFetch } from '$lib/utils/opYearStorage.js';
	import { createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';
	import { accountsStore, accountsLoading } from '$lib/stores/accounts.js';
	import _ from 'lodash';

	export let skeletonCount = 10; // 로딩 중 표시할 스켈레톤 개수
	export let typeValue;

	let accounts = []; // 계정 리스트
	let inputAccount = ''; // 선택된 계정
	let inputSubjects = writable([]); // 선택된 계정의 과목 리스트
	let inputSubject = ''; // 선택된 과목
	let inputSummary = ''; // 입력된 적요
	let inputAmount = ''; // 입력된 금액 (표시용)
	let rawInputAmount = ''; // 실제 전송 금액
	let inputDate = new Date().toISOString().slice(0, 10); // 기본 날짜
	let autoThousand = false; // 천 자리 자동 입력 여부
	let autocompleteSuggestions = []; // 자동완성 목록
	let showAutocomplete = false; // 자동완성 표시 여부
	let activeSuggestionIndex = -1; // 선택된 자동완성 항목 인덱스
	let loading = true; // 로딩 상태

	const dispatch = createEventDispatcher();

	$: accounts = $accountsStore;
	$: loading = $accountsLoading;

	// 선택된 계정의 과목 데이터 가져오기
	async function fetchSubjects(account) {
		try {
			let response = await apiFetch(`/api/getSubjectsByAccount?account=${encodeURIComponent(account)}&typeValue=${encodeURIComponent(typeValue)}`);

			if (!response.ok) {
				console.error('과목 데이터를 가져오는 중 오류 발생:', response.statusText);
				inputSubjects.set([]); // 오류 발생 시 빈 배열 설정
				return;
			}

			let data = await response.json();
			inputSubjects.set([]);  // ✅ 강제 리렌더링을 위해 빈 배열로 초기화
			inputSubjects.set(data); // ✅ subjects를 반응형 store에 반영

			if (data.length > 0) {
				inputSubject = data[0]; // 기본적으로 첫 번째 과목을 선택
			}
		} catch (error) {
			console.error('Failed to fetch subjects:', error);
			inputSubjects.set([]); // 오류 시 빈 배열 설정
		}
	}

	// 금액 입력 핸들러
	function handleAmountInput(event) {
		let value = event.target.value.replace(/,/g, '');
		if (value.includes('+')) {
			value = value.replace('+', '') + '000';
		}
		value = value.replace(/[^0-9]/g, '');
		inputAmount = value ? parseInt(value, 10).toLocaleString('ko-KR') : '';
		rawInputAmount = value;
	}

	// 데이터 추가
	async function addData() {

		// 공백 제거 처리
		inputSummary = inputSummary.trim();
		inputAmount = rawInputAmount.trim();

		// 금액 유효성 검사
		if (!rawInputAmount || isNaN(rawInputAmount) || parseInt(rawInputAmount, 10) <= 0) {
			alert('금액은 0보다 큰 숫자만 입력 가능합니다!');
			resetForm();
			return;
		}

		if (!inputSubject || !inputSummary || !inputDate) {
			alert('모든 필드를 입력해 주세요!');
			resetForm();
			return;
		}

		// 천자리 자동 입력이 체크된 경우 금액에 1000 곱하기
		const adjustedAmount = autoThousand
			? parseInt(rawInputAmount, 10) * 1000
			: parseInt(rawInputAmount, 10);

		const newSpending = {
			계정: inputAccount,
			과목: inputSubject,
			적요: inputSummary,
			금액: adjustedAmount,
			날짜: inputDate
		};

		try {
			await apiFetch('/api/addSpendingData', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newSpending)
			});

			dispatch('dataAdded', newSpending);

		} catch (error) {
			console.error('추가 오류:', error);
			alert('지출 데이터를 추가하는 중 오류가 발생했습니다.');
		} finally {
			resetForm();
		}
	}

	// 입력 필드 초기화
	function resetForm() {
		inputSummary = '';
		inputAmount = '';
		rawInputAmount = '';
	}

	function handleEnter(event) {
		if (event.key === 'Enter') {
			addData(); // 엔터키로 추가
		}
	}

	let lastQuery = ''; // 마지막으로 검색한 쿼리를 저장

	// 자동완성 데이터 가져오기
	async function fetchAutocomplete(query) {
		try {
			if (!query.trim() || query === lastQuery) {
				// 텍스트가 비어있거나 이전 쿼리와 동일하면 호출 중단
				return;
			}

			lastQuery = query; // 마지막 쿼리 업데이트
			autocompleteSuggestions = await (await apiFetch(`/api/autocomplete?query=${query}&type=${encodeURIComponent(typeValue)}`)).json();
			showAutocomplete = autocompleteSuggestions.length > 0;

			if (autocompleteSuggestions.length === 0) {
				activeSuggestionIndex = -1; // 결과가 없을 때 초기화
			}
		} catch (error) {
			console.error('자동완성 오류:', error);
		}
	}

	// 지출 입력 이벤트에 debounce 적용 (500ms)
	const handleNameInput = _.debounce((event) => {
		const ignoredKeys = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
		if (ignoredKeys.includes(event.key)) {
			// 혹시 대기 중인 debounce 호출이 있다면 취소
			handleNameInput.cancel && handleNameInput.cancel();
			return;
		}
		const query = event.target.value.trim();
		fetchAutocomplete(query);
	}, 500);

	// 자동완성 항목 선택
	function selectSuggestion(suggestion) {
		inputSummary = suggestion; // 선택한 항목으로 설정
		autocompleteSuggestions = []; // 자동완성 목록 숨김
		showAutocomplete = false;
	}

	// 키보드 이벤트 처리
	function handleInputKeydown(event) {
		if (!showAutocomplete || autocompleteSuggestions.length === 0) return;

		switch (event.key) {
			case 'ArrowDown':
				// 아래 방향키
				event.preventDefault();
				activeSuggestionIndex = (activeSuggestionIndex + 1) % autocompleteSuggestions.length;
				scrollToActive();
				break;
			case 'ArrowUp':
				// 위 방향키
				event.preventDefault();
				activeSuggestionIndex =
					(activeSuggestionIndex - 1 + autocompleteSuggestions.length) %
					autocompleteSuggestions.length;
				scrollToActive();
				break;
			case 'Enter':
				// 엔터키
				if (activeSuggestionIndex >= 0) {
					selectSuggestion(autocompleteSuggestions[activeSuggestionIndex]);
					event.preventDefault();
				}
				break;
			case 'Escape':
				// ESC 키로 자동완성 숨기기
				showAutocomplete = false;
				break;
		}
	}

	// 활성화된 항목으로 스크롤 이동
	function scrollToActive() {
		const list = document.querySelector('.autocomplete-list'); // 자동완성 목록
		const activeElement = list?.querySelector('.autocomplete-item.selected'); // 선택된 항목

		if (list && activeElement) {
			// 선택된 항목의 중앙 위치 계산
			const itemOffsetTop = activeElement.offsetTop; // 선택된 항목의 offsetTop
			const itemHeight = activeElement.offsetHeight; // 선택된 항목 높이
			const listHeight = list.clientHeight; // 컨테이너 높이

			// 선택된 항목을 컨테이너의 중앙에 위치하도록 계산
			const scrollTo = itemOffsetTop - (listHeight / 2) + (itemHeight / 2);

			// 스크롤 이동
			list.scrollTo({
				top: scrollTo,
				behavior: 'smooth' // 부드러운 스크롤
			});
		}
	}

	$: if (accounts.length > 0) {
		const firstAccount = accounts[0].계정;
		inputAccount = firstAccount;
		fetchSubjects(firstAccount);
	}

</script>

<div class="mb-6">
	<!-- 계정 선택 -->
	<div class="mb-4 flex min-h-[24px] items-center gap-2">
		{#if loading}
			{#each Array(skeletonCount) as _}
				<label class="flex items-center">
					<div class="skeleton h-2 w-2 shrink-0 rounded-full"></div>
				</label>
			{/each}
		{:else if accounts.length > 0}
			{#each accounts as account}
				<label class="flex items-center">
					<input
						type="radio"
						name="inputAccount"
						value={account.계정}
						bind:group={inputAccount}
						class="radio-primary radio mr-2"
						on:change={() => fetchSubjects(account.계정)}
					/>
					{account.계정}
				</label>
			{/each}
		{:else}
			<div class="text-gray-500">등록된 계정이 없습니다.</div>
		{/if}
	</div>

	<!-- 데이터 입력 필드 -->
	<div class="flex items-center gap-4">
		<!-- 과목 선택 -->
		<select bind:value={inputSubject} class="select select-bordered h-12 w-48 text-xl">
			{#each $inputSubjects as subject}
				<option value={subject}>{subject}</option>
			{/each}
		</select>

		<!-- 적요 입력 -->
		<div class="relative w-64">
			<input
				type="text"
				bind:value={inputSummary}
				on:keydown={handleNameInput}
				on:keydown={handleInputKeydown}
				on:blur={() => showAutocomplete = false}
				placeholder="적요"
				class="input input-bordered h-12 w-64 text-xl"
			/>

			<!-- 자동완성 목록 -->
			{#if showAutocomplete}
				<ul
					class="autocomplete-list z-10 max-h-40 w-80 overflow-y-scroll border border-gray-300 bg-white rounded-md shadow-lg">
					{#each autocompleteSuggestions as suggestion, index}
						<li
							class="autocomplete-item cursor-pointer px-4 py-2 hover:bg-gray-100"
							class:selected={index === activeSuggestionIndex}
							on:click={() => selectSuggestion(suggestion)}
						>
							{suggestion}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- 금액 입력 -->
		<input
			type="text"
			value={inputAmount}
			on:keydown={handleEnter}
			placeholder="금액"
			class="w-58 input input-bordered h-12 text-xl"
			on:input={handleAmountInput}
		/>

		<!-- 날짜 입력 -->
		<input
			type="date"
			bind:value={inputDate}
			class="input input-bordered h-12"
		/>

		<!-- 데이터 추가 버튼 -->
		<button on:click={addData} class="btn btn-primary h-12">추가</button>

		<!-- 천 자리 자동 입력 -->
		<div class="flex items-center">
			<input
				type="checkbox"
				bind:checked={autoThousand}
				class="checkbox-primary checkbox mr-2"
			/>
			<span class="text-center text-xl">천단위 자동 입력</span>
		</div>
	</div>
</div>

<style>
    .autocomplete-list {
        position: absolute;
        top: 100%; /* 부모 요소의 아래쪽에 배치 */
        left: 0; /* 부모 요소의 왼쪽에 맞춤 */
        width: 100%; /* 부모 요소와 동일한 너비 */
        max-height: 10rem; /* 최대 높이 설정 */
        overflow-y: auto; /* 내용이 넘칠 경우 스크롤 활성화 */
        border: 1px solid #e5e7eb; /* 테두리 추가 */
        background-color: white; /* 배경 흰색 */
        z-index: 10; /* z-index를 높여 다른 요소 위에 표시 */
        box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1); /* 그림자 효과 */
        border-radius: 0.25rem; /* 모서리를 약간 둥글게 */
    }

    .z-10 {
        z-index: 10;
    }

    .max-h-40 {
        max-height: 10rem;
    }

    .border {
        border: 1px solid #e5e7eb;
    }

    .bg-white {
        background-color: white;
    }

    .cursor-pointer {
        cursor: pointer;
    }

    .selected {
        background-color: #e5f4ff; /* 선택된 항목의 배경색 */
    }
</style>
