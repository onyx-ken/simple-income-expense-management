export function formatDate(dateString) {
	const date = new Date(dateString);

	// 월(MM)과 일(DD)을 2자리 형식으로 추출
	const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth()는 0부터 시작하므로 +1
	const day = String(date.getDate()).padStart(2, '0');

	// MM-DD 형식으로 반환
	return `${month}-${day}`;
}

export function formatCurrency(amount) {
	if (typeof amount !== 'number') amount = parseInt(amount, 10); // 문자열인 경우 숫자로 변환
	return amount.toLocaleString('ko-KR'); // 한국 기준 3자리 쉼표 추가
}
