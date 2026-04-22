const express = require('express');
const ADODB = require('node-adodb');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 1) Express 앱 생성
const app = express();
// JSON 바디 파싱 (POST 요청 시 body에 JSON 받을 수 있게 함)
app.use(express.json({ limit: '20mb' }));

// 2) MDB 연결 문자열 설정
// 파일 경로에 주의: \ 대신 / 또는 \\ 로 써야 합니다.
// ACE.OLEDB.12.0 Provider가 설치되어 있어야 합니다. (오피스/Access 런타임 등)
// MDB 파일 경로 (프로젝트 루트 > mdb 폴더 > tre2025.mdb)
const isX64 = true;
const providerVersion = '12.0';

// 2) MDB 연결 문자열 설정 (함수로 변경)
function getConnection(opYear) {
    const year = opYear || new Date().getFullYear();

    // Electron 실행 파일과 같은 위치에서 MDB 파일 경로 설정
    const basePath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, 'mdb') // 개발 환경에서는 기존 경로 사용
        : path.dirname(process.execPath); // 배포 환경에서는 실행 파일과 동일한 위치

    const msAccessDbPath = path.join(basePath, `tre${year}.mdb`);
    const providerString = `Provider=Microsoft.ACE.OLEDB.${providerVersion};Data Source=${msAccessDbPath};Persist Security Info=False;`;

    return ADODB.open(providerString, isX64);
}

// 3) API 라우트 - 데이터 조회

// 계정별 과목 데이터 조회
app.get('/api/getSubjectsByAccount', async (req, res) => {
    try {

        let { account, typeValue, opYear } = req.query;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!account) {
            return res.status(400).json({ message: '계정을 입력하세요.' });
        }

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        const query = `
            SELECT DISTINCT 과목
            FROM 예산
            WHERE 계정 = '${account}'
            AND 수입지출 = '${typeValue}'
        `;

        const rows = await connection.query(query);
        res.status(200).json(rows.map(row => row.과목));
    } catch (error) {
        console.error('과목 조회 오류:', error);
        res.status(500).json({ message: '과목 데이터를 가져오는 중 오류가 발생했습니다.' });
    }
});

app.get('/api/getIncomeData', async (req, res) => {
    try {
        let { selectedAccount, selectedSubject, start, end, name, opYear } = req.query;
        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        // 기본 SELECT 문
        let queryStr = 'SELECT * FROM 수입 WHERE 1=1';

        // 계정 조건
        if (selectedAccount && selectedAccount !== '전체') {
            queryStr += ` AND 계정='${selectedAccount}'`;
        }

        // 과목 조건
        if (selectedSubject && selectedSubject !== '전체') {
            queryStr += ` AND 과목='${selectedSubject}'`;
        }

        // 연도 조건
        if (opYear) {
            queryStr += ` AND YEAR(날짜) = ${opYear}`;
        }

        // 기간 조건
        if (start) {
            queryStr += ` AND 날짜 >= #${start}#`; // Access의 날짜 형식
        }
        if (end) {
            queryStr += ` AND 날짜 <= #${end}#`;
        }

        queryStr += buildTextSearchClause('이름', name);

        queryStr += ' ORDER BY 날짜, id';

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        // 쿼리 실행
        const rows = await connection.query(queryStr);

        // UTC에서 로컬 시간대로 변환 후 반환
        res.json(formatDateForJSON(rows));

    } catch (error) {
        console.error('Database query error:', error);

        // 에러 객체의 속성을 안전하게 확인
        const errorMessage = error?.message || 'Unknown error';
        const errorCode = error?.code || 'Unknown code';
        const processMessage = error?.process?.message || 'No process message';
        const processCode = error?.process?.code || 'No process code';

        // 응답으로 에러 정보 반환
        res.status(500).json({
            error: errorMessage,
            code: errorCode,
            process: {
                message: processMessage,
                code: processCode
            }
        });
    }
});

app.get('/api/autocomplete', async (req, res) => {
    try {
        let { query, opYear, type } = req.query;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        // 필요한 매개변수 검증
        if (!query || !type) {
            return res.status(400).json({ message: '검색어(query)와 타입(type)은 필수입니다.' });
        }

        // 허용된 테이블 이름 목록 정의 (SQL 인젝션 방지)
        const allowedTables = ['수입', '지출'];
        if (!allowedTables.includes(type)) {
            return res.status(400).json({ message: '유효하지 않은 type 값입니다.' });
        }

        // SQL 쿼리 생성 (LIKE 조건으로 검색)
        let sql;
        let mapField;

        if (type === '수입') {
            sql = `SELECT DISTINCT 이름 AS field FROM 수입 WHERE 이름 LIKE '%${query}%'`;
            mapField = 'field'; // 매핑 필드 설정
        } else if (type === '지출') {
            sql = `SELECT DISTINCT 적요 AS field FROM 지출 WHERE 적요 LIKE '%${query}%'`;
            mapField = 'field'; // 매핑 필드 설정
        }

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        const rows = await connection.query(sql);
        res.json(rows.map(row => row[mapField])); // 결과 매핑 필드로 반환

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.', details: String(error) });
    }
});

app.get('/api/getSpendingData', async (req, res) => {
    try {
        let { selectedAccount, selectedSubject, start, end, summary, opYear } = req.query;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        // 기본 SELECT 문
        let queryStr = 'SELECT * FROM 지출 WHERE 1=1';

        // 계정 조건
        if (selectedAccount && selectedAccount !== '전체') {
            queryStr += ` AND 계정='${selectedAccount}'`;
        }

        // 과목 조건
        if (selectedSubject && selectedSubject !== '전체') {
            queryStr += ` AND 과목='${selectedSubject}'`;
        }

        // 연도 조건
        if (opYear) {
            queryStr += ` AND YEAR(날짜) = ${opYear}`;
        }

        // 기간 조건
        if (start) {
            queryStr += ` AND 날짜 >= #${start}#`; // Access의 날짜 형식
        }
        if (end) {
            queryStr += ` AND 날짜 <= #${end}#`;
        }

        queryStr += buildTextSearchClause('적요', summary);

        queryStr += ' ORDER BY 날짜, id';

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        // 쿼리 실행
        const rows = await connection.query(queryStr);

        // UTC에서 로컬 시간대로 변환 후 반환
        res.json(formatDateForJSON(rows));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: String(error) });
    }
});

app.post('/api/addIncomeData', async (req, res) => {
    try {
        let { 계정, 과목, 이름, 금액, 날짜, opYear } = req.body;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!계정 || !과목 || !이름 || !금액 || !날짜) {
            return res.status(400).json({ message: '모든 필드를 입력해 주세요.' });
        }

        const query = `
            INSERT INTO 수입 (계정, 과목, 이름, 금액, 날짜)
            VALUES ('${계정}', '${과목}', '${이름}', ${금액}, #${날짜}#)
        `;

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        await connection.execute(query);
        res.status(200).json({ message: '수입 데이터가 성공적으로 추가되었습니다.' });
    } catch (error) {
        console.error('추가 오류:', error);
        res.status(500).json({ message: '수입 데이터를 추가하는 중 오류가 발생했습니다.' });
    }
});

app.delete('/api/deleteIncomeData/:id', async (req, res) => {
    let { id, opYear } = req.params;

    // 기본 연도 설정
    opYear = opYear || new Date().getFullYear();

    try {
        const query = `DELETE FROM 수입 WHERE id = ${id}`;
        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        await connection.execute(query);
        res.status(200).json({ message: '데이터가 삭제되었습니다.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '데이터 삭제 중 오류가 발생했습니다.' });
    }
});

app.put('/api/updateIncomeData/:id', async (req, res) => {
    try {
        let { id } = req.params;
        let { 계정, 과목, 이름, 금액, 날짜, opYear } = req.body;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!계정 || !과목 || !이름 || !금액 || !날짜) {
            return res.status(400).json({ message: '모든 필드를 입력해 주세요.' });
        }

        const query = `
            UPDATE 수입
            SET 계정 = '${계정}', 과목 = '${과목}', 이름 = '${이름}', 금액 = ${금액}, 날짜 = #${날짜}#
            WHERE id = ${id}
        `;

        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        await connection.execute(query);

        res.status(200).json({ message: '수입 데이터가 성공적으로 수정되었습니다.' });
    } catch (error) {
        console.error('수정 오류:', error);
        res.status(500).json({ message: '수입 데이터를 수정하는 중 오류가 발생했습니다.' });
    }
});

// 지출 데이터 추가
app.post('/api/addSpendingData', async (req, res) => {
    try {
        let { 계정, 과목, 적요, 금액, 날짜, opYear } = req.body;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!계정 || !과목 || !적요 || !금액 || !날짜) {
            return res.status(400).json({ message: '모든 필드를 입력해 주세요.' });
        }

        // 괄호 내 문자열 제거 로직 적용
        const processedDescription = processDescription(과목, 적요);

        const query = `
            INSERT INTO 지출 (계정, 과목, 적요, 금액, 날짜)
            VALUES ('${계정}', '${과목}', '${processedDescription}', ${금액}, #${날짜}#)
        `;

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        await connection.execute(query);
        res.status(200).json({ message: '지출 데이터가 성공적으로 추가되었습니다.' });
    } catch (error) {
        console.error('추가 오류:', error);
        res.status(500).json({ message: '지출 데이터를 추가하는 중 오류가 발생했습니다.' });
    }
});

// 지출 데이터 수정
app.put('/api/updateSpendingData/:id', async (req, res) => {
    try {
        let { id } = req.params;
        let { 계정, 과목, 적요, 금액, 날짜, opYear } = req.body;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!계정 || !과목 || !적요 || !금액 || !날짜) {
            return res.status(400).json({ message: '모든 필드를 입력해 주세요.' });
        }

        // 괄호 내 문자열 제거 로직 적용
        const processedDescription = processDescription(과목, 적요);

        const query = `
            UPDATE 지출
            SET 계정 = '${계정}', 과목 = '${과목}', 적요 = '${processedDescription}', 금액 = ${금액}, 날짜 = #${날짜}#
            WHERE id = ${id}
        `;

        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        await connection.execute(query);

        res.status(200).json({ message: '지출 데이터가 성공적으로 수정되었습니다.' });
    } catch (error) {
        console.error('수정 오류:', error);
        res.status(500).json({ message: '지출 데이터를 수정하는 중 오류가 발생했습니다.' });
    }
});

app.delete('/api/deleteSpendingData/:id', async (req, res) => {
    let { id, opYear } = req.params;

    // 기본 연도 설정
    opYear = opYear || new Date().getFullYear();

    try {
        const query = `DELETE FROM 지출 WHERE id = ${id}`;
        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        await connection.execute(query);
        res.status(200).json({ message: '데이터가 삭제되었습니다.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '데이터 삭제 중 오류가 발생했습니다.' });
    }
});

app.get('/api/getSummary', async (req, res) => {
    try {
        const { type = '전체', start, end, opYear } = req.query;

        // 기본 연도 설정
        const year = opYear || new Date().getFullYear();

        // 동적으로 연결 생성
        const connection = getConnection(year);

        // 공통 조건
        let baseQuery = `WHERE 1=1`;
        let previousQuery = `WHERE 1=1`; // 이전 기간 (이월금) 계산용

        if (start) {
            baseQuery += ` AND 날짜 >= #${start}#`;
            previousQuery += ` AND 날짜 < #${start}#`; // 검색 기간 이전의 데이터
        }

        if (end) {
            baseQuery += ` AND 날짜 <= #${end}#`;
        }

        let incomeQuery = `SELECT 계정, 과목, 이름 AS 항목, 금액, 날짜 FROM 수입 ${baseQuery}`;
        let spendingQuery = `SELECT 계정, 과목, 적요 AS 항목, 금액, 날짜 FROM 지출 ${baseQuery}`;

        let prevIncomeQuery = `SELECT SUM(금액) AS total FROM 수입 ${previousQuery}`;
        let prevSpendingQuery = `SELECT SUM(금액) AS total FROM 지출 ${previousQuery}`;

        // 전체 데이터 결과
        let incomeData = [];
        let spendingData = [];
        let previousIncome = 0;
        let previousSpending = 0;

        if (type === '전체' || type === '수입') {
            incomeData = await connection.query(incomeQuery);
            const prevIncomeResult = await connection.query(prevIncomeQuery);
            previousIncome = prevIncomeResult[0]?.total || 0;
        }

        if (type === '전체' || type === '지출') {
            spendingData = await connection.query(spendingQuery);
            const prevSpendingResult = await connection.query(prevSpendingQuery);
            previousSpending = prevSpendingResult[0]?.total || 0;
        }

        // 이월금 계산
        const previousBalance = previousIncome - previousSpending;

        // 데이터 통합 및 정리
        const combinedData = [...incomeData, ...spendingData];

        const summary = combinedData.reduce((acc, row) => {
            const { 계정, 과목, 항목, 금액 } = row;
            const category = incomeData.includes(row) ? '수입' : '지출';

            // 계정별 초기화
            if (!acc[category][계정]) {
                acc[category][계정] = {
                    total: 0,
                    subjects: {},
                };
            }

            // 과목별 초기화
            if (!acc[category][계정].subjects[과목]) {
                acc[category][계정].subjects[과목] = {
                    total: 0,
                    items: [],
                };
            }

            // 데이터 추가
            acc[category][계정].total += 금액;
            acc[category][계정].subjects[과목].total += 금액;
            acc[category][계정].subjects[과목].items.push({ 항목, 금액 });

            return acc;
        }, {
            수입: {},
            지출: {},
        });

        // 결과 반환 (이월금 포함)
        res.json({
            summary,
            details: combinedData,
            previousBalance // 이월금 정보 추가
        });
    } catch (error) {
        console.error('통계 데이터 처리 중 오류:', error);
        res.status(500).json({ message: '통계 데이터를 처리하는 중 오류가 발생했습니다.' });
    }
});

app.get('/api/getBudgetData', async (req, res) => {
    let { opYear } = req.params;

    // 기본 연도 설정
    opYear = opYear || new Date().getFullYear();

    try {
        const query = 'SELECT * FROM 예산';
        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        const rows = await connection.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('조회 오류:', error);
        res.status(500).json({ message: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

app.post('/api/addBudgetData', async (req, res) => {
    let { opYear } = req.params;

    // 기본 연도 설정
    opYear = opYear || new Date().getFullYear();

    try {
        const { 번호, 계정, 수입지출, 과목, 금액 } = req.body;

        // 필수 입력 검증
        if (!계정 || !과목 || !수입지출) {
            return res.status(400).json({ message: '계정, 과목, 수입지출은 필수 입력 항목입니다.' });
        }

        const query = `
            INSERT INTO 예산 (번호, 계정, 수입지출, 과목, 금액)
            VALUES (${번호 || 'NULL'}, '${계정}', '${수입지출}', '${과목}', ${금액 || 'NULL'})
        `;

        // 동적으로 연결 생성
        const connection = getConnection(opYear);

        await connection.execute(query);
        res.status(200).json({ message: '데이터가 성공적으로 추가되었습니다.' });
    } catch (error) {
        console.error('추가 오류:', error);
        res.status(500).json({ message: '데이터 추가 중 오류가 발생했습니다.' });
    }
});

app.delete('/api/deleteBudgetData', async (req, res) => {
    let { accountName, subjectId, opYear } = req.query;

    // 기본 연도 설정
    opYear = opYear || new Date().getFullYear();

    try {
        if (accountName) {
            // 계정 삭제 처리
            const deleteAccountQuery = `
                DELETE FROM 예산
                WHERE 계정 = '${accountName}'
            `;
            // 동적으로 연결 생성
            const connection = getConnection(opYear);
            await connection.execute(deleteAccountQuery);

            return res.status(200).json({ message: '계정과 관련된 모든 데이터가 삭제되었습니다.' });
        }

        if (subjectId) {
            // 과목 삭제 처리
            const deleteSubjectQuery = `
                DELETE FROM 예산
                WHERE id = ${subjectId}
            `;
            // 동적으로 연결 생성
            const connection = getConnection(opYear);
            await connection.execute(deleteSubjectQuery);

            return res.status(200).json({ message: '과목이 삭제되었습니다.' });
        }

        // 요청 파라미터가 없을 경우 에러 반환
        return res.status(400).json({ message: '계정 또는 과목 식별자를 제공해야 합니다.' });
    } catch (error) {
        console.error('삭제 오류:', error);
        return res.status(500).json({ message: '데이터 삭제 중 오류가 발생했습니다.' });
    }
});

// 계정 조회 (중복 제거)
app.get('/api/getAccounts', async (req, res) => {
    let { opYear } = req.params;

    // 기본 연도 설정
    opYear = opYear || new Date().getFullYear();

    try {
        const query = `
            SELECT 계정, MIN(id) AS id
            FROM 예산
            WHERE 과목 IS NOT NULL
            GROUP BY 계정
            ORDER BY MIN(id);
        `;
        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        const rows = await connection.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('계정 조회 오류:', error);
        res.status(500).json({ message: '계정 데이터를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 계정 추가
app.post('/api/addAccount', async (req, res) => {
    try {
        let { 계정, opYear } = req.body;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!계정) {
            return res.status(400).json({ success: false, message: '계정 이름은 필수 입력 항목입니다.' });
        }

        const connection = getConnection(opYear);

        // 새로운 계정 삽입
        const queryInsert = `
            INSERT INTO 예산 (계정, 금액)
            VALUES ('${계정}', 0)
        `;
        await connection.execute(queryInsert);

        // ✅ 응답 명확화
        res.status(200).json({
            success: true,
            message: '새 계정이 추가되었습니다.',
            account: { 계정 },
        });

    } catch (error) {
        console.error('계정 추가 오류:', error);
        res.status(500).json({
            success: false,
            message: '계정을 추가하는 중 오류가 발생했습니다.',
            error: error.toString(),
        });
    }
});

// 과목 추가
app.post('/api/addSubject', async (req, res) => {
    try {
        let { 계정, 번호, 수입지출, 과목, opYear } = req.body;

        // 기본 연도 설정
        opYear = opYear || new Date().getFullYear();

        if (!계정 || !번호 || !수입지출 || !과목) {
            return res.status(400).json({ message: '모든 필드를 입력해야 합니다.' });
        }

        // 번호 중복 체크 (계정 및 수입지출 기준)
        const checkQuery = `
            SELECT count(*) AS [count]
            FROM 예산 
            WHERE 계정 = '${계정}'
            AND 번호 = ${번호}
            AND 수입지출 = '${수입지출}'
        `;

        // 동적으로 연결 생성
        const connection = getConnection(opYear);
        const [checkResult] = await connection.query(checkQuery);

        if (checkResult.count > 0) {
            return res.status(400).json({ message: '동일한 번호가 이미 존재합니다.' });
        }

        // 계정 내 가장 높은 ID 가져오기
        const maxIdQuery = `
            SELECT TOP 1 *
            FROM 예산
            WHERE 계정 = '${계정}'
            ORDER BY id DESC
        `;

        const [maxIdResult] = await connection.query(maxIdQuery);

        const maxIdRow = maxIdResult;

        if (maxIdRow && (!maxIdRow['수입지출'] || !maxIdRow['과목'])) {

            // 덮어쓰기 로직
            const updateQuery = `
                UPDATE 예산
                SET 번호 = ${번호}, 수입지출 = '${수입지출}', 과목 = '${과목}'
                WHERE id = ${maxIdRow.id}
            `;

            await connection.execute(updateQuery);
            res.status(200).json({ message: '기존 데이터를 갱신했습니다.' });
        } else {
            // 새로운 데이터 추가 로직
            const insertQuery = `
                INSERT INTO 예산 (계정, 번호, 수입지출, 과목, 금액)
                VALUES ('${계정}', ${번호}, '${수입지출}', '${과목}', 0)
            `;
            await connection.execute(insertQuery);
            res.status(200).json({ message: '새로운 과목이 추가되었습니다.' });
        }
    } catch (error) {
        console.error('과목 추가 오류:', error);
        res.status(500).json({ message: '과목을 추가하는 중 오류가 발생했습니다.' });
    }
});

app.post('/api/parseBankExcel', async (req, res) => {
    let tempFilePath;

    try {
        const { fileName, fileBase64, targetType } = req.body;
        const { opYear } = req.query;

        if (!fileName || !fileBase64 || !['income', 'spending'].includes(targetType)) {
            return res.status(400).json({ message: '엑셀 파일과 입력 종류가 필요합니다.' });
        }

        const fileBuffer = Buffer.from(fileBase64, 'base64');
        const extension = path.extname(fileName).toLowerCase() || '.xls';
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-am-bank-'));
        tempFilePath = path.join(tempDir, `upload${extension}`);
        fs.writeFileSync(tempFilePath, fileBuffer);

        const excelRows = await readExcelRows(tempFilePath);
        const parsed = parseBankStatementRows(excelRows);
        const connection = getConnection(opYear);
        const budgetSubjects = await fetchBudgetSubjects(connection, targetType);
        const existingRows = await fetchExistingLedgerRows(connection, targetType);
        const rows = buildBankImportRows(parsed.transactions, targetType, parsed.accountNumber, budgetSubjects, existingRows);

        res.status(200).json({
            fileName,
            accountNumber: parsed.accountNumber,
            totalCount: parsed.transactions.length,
            importableCount: rows.filter(row => row.status === 'ready').length,
            reviewCount: rows.filter(row => row.status === 'needs_review').length,
            skippedCount: rows.filter(row => row.status === 'skip').length,
            subjectsByAccount: budgetSubjects,
            rows
        });
    } catch (error) {
        console.error('엑셀 분석 오류:', error);
        res.status(500).json({ message: '엑셀 파일을 분석하는 중 오류가 발생했습니다.', details: String(error) });
    } finally {
        if (tempFilePath) {
            try {
                fs.rmSync(path.dirname(tempFilePath), { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('임시 엑셀 파일 삭제 오류:', cleanupError);
            }
        }
    }
});

app.post('/api/importBankExcelRows', async (req, res) => {
    try {
        const { rows, targetType } = req.body;
        const { opYear } = req.query;

        if (!Array.isArray(rows) || !['income', 'spending'].includes(targetType)) {
            return res.status(400).json({ message: '입력할 거래 목록이 필요합니다.' });
        }

        const connection = getConnection(opYear);
        const existingRows = await fetchExistingLedgerRows(connection, targetType);
        let insertedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const row of rows) {
            const normalized = normalizeImportRow(row);

            if (!normalized) {
                skippedCount += 1;
                errors.push({ rowId: row?.id, message: '필수 값이 빠진 행입니다.' });
                continue;
            }

            if (findExactExistingRow(normalized, existingRows)) {
                skippedCount += 1;
                continue;
            }

            try {
                await connection.execute(buildLedgerInsertQuery(normalized, targetType));
                existingRows.push(normalized);
                insertedCount += 1;
            } catch (insertError) {
                skippedCount += 1;
                errors.push({ rowId: row?.id, message: String(insertError) });
            }
        }

        res.status(200).json({ insertedCount, skippedCount, errors });
    } catch (error) {
        console.error('엑셀 일괄 입력 오류:', error);
        res.status(500).json({ message: '거래 내역을 입력하는 중 오류가 발생했습니다.', details: String(error) });
    }
});

function formatDateForJSON(rows) {
    return rows.map(row => {
        if (row.날짜) {
            const date = new Date(row.날짜); // .mdb에서 가져온 날짜
            row.날짜 = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        }
        return row;
    });
}

// 공통 함수: 괄호 안의 문자열 추출 및 적요에서 제거
function processDescription(subject, description) {
    const regex = /\(([^)]+)\)/; // 괄호 안의 문자열 추출 정규식
    const match = subject.match(regex);

    if (match) {
        const keyword = match[1]; // 괄호 안의 문자열
        const keywordRegex = new RegExp(keyword, 'g'); // 해당 키워드 삭제용 정규식

        // 적요에서 해당 키워드를 제거하고 양쪽 공백 제거
        return description.replace(keywordRegex, '').trim();
    }
    return description; // 괄호가 없으면 기존 값 유지
}

function buildTextSearchClause(fieldName, rawQuery) {
    const { includeTerms, excludeTerms } = parseTextSearchQuery(rawQuery);
    const clauses = [];

    for (const term of includeTerms) {
        clauses.push(`${fieldName} LIKE '%${escapeSql(term)}%'`);
    }

    for (const term of excludeTerms) {
        clauses.push(`(${fieldName} IS NULL OR ${fieldName} NOT LIKE '%${escapeSql(term)}%')`);
    }

    return clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';
}

function parseTextSearchQuery(rawQuery) {
    const includeTerms = [];
    const excludeTerms = [];
    const query = cleanCell(rawQuery);
    const tokenRegex = /(-?)"([^"]+)"|(-?)(\S+)/g;
    let match;

    while ((match = tokenRegex.exec(query)) !== null) {
        const isExcluded = Boolean(match[1] || match[3]);
        const term = cleanCell(match[2] || match[4]);

        if (!term || term === '-') {
            continue;
        }

        if (isExcluded) {
            excludeTerms.push(term);
        } else {
            includeTerms.push(term);
        }
    }

    return { includeTerms, excludeTerms };
}

function openExcelConnection(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const excelType = extension === '.xlsx' ? 'Excel 12.0 Xml' : 'Excel 8.0';
    const providerString = `Provider=Microsoft.ACE.OLEDB.${providerVersion};Data Source=${filePath};Extended Properties="${excelType};HDR=NO;IMEX=1";`;
    return ADODB.open(providerString, isX64);
}

async function readExcelRows(filePath) {
    const connection = openExcelConnection(filePath);
    const sheetNames = await getExcelSheetNames(connection);
    let lastError;

    for (const sheetName of sheetNames) {
        try {
            const escapedSheetName = String(sheetName).replace(/]/g, ']]');
            const rows = await connection.query(`SELECT * FROM [${escapedSheetName}]`);
            if (Array.isArray(rows) && rows.length > 0) {
                return rows;
            }
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('엑셀 시트를 찾을 수 없습니다.');
}

async function getExcelSheetNames(connection) {
    try {
        const schemaRows = await connection.schema(20);
        const names = schemaRows
            .map(row => row.TABLE_NAME || row.table_name)
            .filter(name => name && String(name).includes('$'));

        if (names.length > 0) {
            return names;
        }
    } catch (error) {
        console.warn('엑셀 시트 목록 조회 실패, 기본 시트명으로 재시도합니다:', error);
    }

    return ['Sheet0$', 'Sheet1$'];
}

function parseBankStatementRows(rows) {
    const headerIndex = rows.findIndex(row => Object.values(row).some(value => cleanCell(value).includes('거래일자')));
    const headerRow = headerIndex >= 0 ? rows[headerIndex] : {};
    const keys = {
        sequence: findColumnKey(headerRow, '구분') || 'F1',
        date: findColumnKey(headerRow, '거래일자') || 'F2',
        withdrawal: findColumnKey(headerRow, '출금금액') || 'F3',
        deposit: findColumnKey(headerRow, '입금금액') || 'F4',
        balance: findColumnKey(headerRow, '거래 후 잔액') || 'F5',
        content: findColumnKey(headerRow, '거래내용') || 'F6',
        record: findColumnKey(headerRow, '거래기록사항') || 'F7',
        branch: findColumnKey(headerRow, '거래점') || 'F8',
        time: findColumnKey(headerRow, '거래시간') || 'F9',
        memo: 'F10'
    };
    const accountNumber = findAccountNumber(rows);
    const sourceRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

    const transactions = sourceRows
        .map((row, index) => {
            const date = normalizeBankDate(row[keys.date]);
            const sequence = cleanCell(row[keys.sequence]);
            const withdrawal = parseWon(row[keys.withdrawal]);
            const deposit = parseWon(row[keys.deposit]);

            if (!date || (!withdrawal && !deposit)) {
                return null;
            }

            return {
                id: `${date}-${sequence || index + 1}-${withdrawal || deposit}`,
                rowNumber: index + 1,
                sequence,
                date,
                withdrawal,
                deposit,
                amount: deposit || withdrawal,
                direction: deposit > 0 ? 'income' : 'spending',
                balance: parseWon(row[keys.balance]),
                content: cleanCell(row[keys.content]),
                record: cleanCell(row[keys.record]),
                branch: cleanCell(row[keys.branch]),
                time: cleanCell(row[keys.time]),
                memo: cleanCell(row[keys.memo])
            };
        })
        .filter(Boolean);

    return { accountNumber, transactions };
}

function findColumnKey(headerRow, label) {
    return Object.entries(headerRow).find(([, value]) => cleanCell(value).includes(label))?.[0];
}

function findAccountNumber(rows) {
    for (const row of rows) {
        for (const value of Object.values(row)) {
            const text = cleanCell(value);
            const match = text.match(/\d{3}-[\d-]+/);
            if (match) {
                return match[0];
            }
        }
    }
    return '';
}

async function fetchBudgetSubjects(connection, targetType) {
    const typeName = targetType === 'income' ? '수입' : '지출';
    const rows = await connection.query(`
        SELECT 계정, 과목
        FROM 예산
        WHERE 수입지출 = '${typeName}'
        AND 과목 IS NOT NULL
        ORDER BY 계정, 번호, id
    `);

    return rows.reduce((acc, row) => {
        if (!row.계정 || !row.과목) {
            return acc;
        }

        if (!acc[row.계정]) {
            acc[row.계정] = [];
        }
        acc[row.계정].push(row.과목);
        return acc;
    }, {});
}

async function fetchExistingLedgerRows(connection, targetType) {
    const tableName = targetType === 'income' ? '수입' : '지출';
    const titleField = targetType === 'income' ? '이름' : '적요';
    const rows = await connection.query(`
        SELECT 날짜, 계정, 과목, ${titleField} AS 제목, 금액
        FROM ${tableName}
    `);

    return rows.map(row => ({
        date: normalizeDbDate(row.날짜),
        account: cleanCell(row.계정),
        subject: cleanCell(row.과목),
        title: cleanCell(row.제목),
        amount: Number(row.금액) || 0
    }));
}

function buildBankImportRows(transactions, targetType, accountNumber, budgetSubjects, existingRows) {
    return transactions.map(transaction => {
        const row = buildBankImportRow(transaction, targetType, accountNumber, budgetSubjects, existingRows);
        return {
            ...row,
            selected: row.status === 'ready'
        };
    });
}

function buildBankImportRow(transaction, targetType, accountNumber, budgetSubjects, existingRows) {
    const raw = {
        accountNumber,
        sequence: transaction.sequence,
        withdrawal: transaction.withdrawal,
        deposit: transaction.deposit,
        balance: transaction.balance,
        content: transaction.content,
        record: transaction.record,
        branch: transaction.branch,
        time: transaction.time,
        memo: transaction.memo
    };

    if (transaction.direction !== targetType) {
        return {
            id: transaction.id,
            status: 'skip',
            reason: targetType === 'income' ? '출금 거래라 수입 입력에서 제외' : '입금 거래라 지출 입력에서 제외',
            date: transaction.date,
            account: '',
            subject: '',
            title: transaction.record || transaction.content,
            amount: transaction.amount,
            raw
        };
    }

    const transferReason = getInternalTransferReason(transaction, accountNumber);
    if (transferReason) {
        return {
            id: transaction.id,
            status: 'skip',
            reason: transferReason,
            date: transaction.date,
            account: '',
            subject: '',
            title: transaction.record || transaction.content,
            amount: transaction.amount,
            raw
        };
    }

    const guessed = targetType === 'income'
        ? guessIncomeRow(transaction, accountNumber)
        : guessSpendingRow(transaction, accountNumber);

    const matchedExisting = findSimilarExistingRow(transaction, guessed, existingRows);
    const row = matchedExisting
        ? {
            ...guessed,
            account: matchedExisting.account,
            subject: matchedExisting.subject,
            title: matchedExisting.title,
            reason: guessed.reason || '기존 입력과 같은 날짜/금액/내용 패턴'
        }
        : guessed;

    row.date = transaction.date;
    row.amount = transaction.amount;
    row.raw = raw;
    row.id = transaction.id;

    if (!isBudgetSubject(row.account, row.subject, budgetSubjects)) {
        row.status = 'needs_review';
        row.reason = row.reason || '예산에 없는 계정/과목이라 확인 필요';
    }

    if (findExactExistingRow(row, existingRows)) {
        row.status = 'skip';
        row.reason = '이미 입력된 거래';
    }

    return row;
}

function guessIncomeRow(transaction, accountNumber) {
    const fullText = buildTransactionText(transaction);
    const record = transaction.record || transaction.memo || transaction.content;
    const isAccount355 = String(accountNumber).startsWith('355');
    let account = '일반';
    let subject = '감사헌금';
    let status = 'ready';
    let reason = '';

    if (includesAny(fullText, ['건축헌금', '건축'])) {
        account = '건축';
        subject = '건축헌금';
    } else if (includesAny(fullText, ['신년'])) {
        subject = '신년감사헌금';
    } else if (includesAny(fullText, ['부활', '부활주일', '부활감사'])) {
        subject = '부활절헌금';
    } else if (includesAny(fullText, ['맥추'])) {
        subject = '맥추감사헌금';
    } else if (includesAny(fullText, ['추수'])) {
        subject = '추수감사헌금';
    } else if (includesAny(fullText, ['성탄'])) {
        subject = '성탄감사헌금';
    } else if (includesAny(fullText, ['음향', '앰프'])) {
        subject = '음향개선헌금';
    } else if (includesAny(fullText, ['차량'])) {
        subject = '차량헌금';
    } else if (includesAny(fullText, ['선교'])) {
        subject = '선교헌금';
    } else if (includesAny(fullText, ['십일조']) || /십\s*$/.test(record)) {
        subject = '십일조헌금';
    } else if (includesAny(fullText, ['주일헌금'])) {
        subject = '주일헌금';
    } else if (includesAny(fullText, ['겨울캠프', '캠프후원'])) {
        subject = '교회학교헌금';
    } else if (includesAny(fullText, ['예금이자', '이자', 'NH체크할인', '체크할인', '반찬나눔'])) {
        subject = '기타헌금';
    }

    const isClearBankIncome = includesAny(fullText, ['예금이자', '이자', 'NH체크할인', '체크할인']);

    if (isAccount355 && !isClearBankIncome) {
        status = 'needs_review';
        reason = '355 계좌 입금은 헌금 합계 또는 환급일 수 있어 확인 필요';
    }

    if (isAccount355 && includesAny(fullText, ['일반헌금'])) {
        subject = '주일헌금';
        status = 'needs_review';
        reason = '통장에는 일반헌금 합계로 표시되어 과목 확인 필요';
    }

    if (includesAny(fullText, ['예금이자', '이자'])) {
        return { account, subject: '기타헌금', title: '예금이자(통장)', status, reason };
    }

    if (includesAny(fullText, ['NH체크할인', '체크할인'])) {
        return { account, subject: '기타헌금', title: '체크 할인', status, reason };
    }

    const title = makeIncomeTitle(record, subject);
    return { account, subject, title, status, reason };
}

function guessSpendingRow(transaction) {
    const fullText = buildTransactionText(transaction);
    let account = '일반';
    let subject = '관리유지비';
    let status = 'ready';
    let reason = '';

    if (includesAny(fullText, ['대출원금'])) {
        account = '건축';
        subject = '대출원금';
    } else if (includesAny(fullText, ['대출금 이자', '대출이자'])) {
        account = '건축';
        subject = '대출금 이자';
    } else if (includesAny(fullText, ['퇴직적립'])) {
        subject = '퇴직적립금';
    } else if (includesAny(fullText, ['사회보험'])) {
        subject = '사회보험료';
    } else if (includesAny(fullText, ['선교비'])) {
        subject = '선교사업비';
    } else if (includesAny(fullText, ['부담금'])) {
        subject = '부담금';
    } else if (includesAny(fullText, ['연회등록', '등록비', '부목사 연회', '성경선물', '사무용품', '문구', '종이컵', '임명장', '우편', '헌금봉투'])) {
        subject = '사무행정비';
    } else if (includesAny(fullText, ['식대', '식사', '마트', '송편', '전도', '꽃', '심방', '병원', '장례', '조의금', '부활절계란', '사탕', '금관유통', '초청', '협찬'])) {
        subject = '문화사업비';
    }

    if (includesAny(fullText, ['헌금']) && !includesAny(fullText, ['헌금봉투', '헌금꽂이'])) {
        status = 'needs_review';
        reason = '헌금 관련 출금이라 지출 여부 확인 필요';
    }

    return {
        account,
        subject,
        title: makeSpendingTitle(transaction),
        status,
        reason
    };
}

function makeIncomeTitle(record, subject) {
    let title = cleanCell(record) || '통장입금';
    title = title.replace(/[\/_-]+/g, ' ');

    const removableWords = [
        subject,
        '헌금',
        '십일조',
        '십',
        '건축',
        '선교',
        '신년',
        '감사',
        '부활주일',
        '부활감사',
        '부활',
        '맥추',
        '추수',
        '성탄',
        '음향개선',
        '음향기기',
        '음향',
        '앰프목적',
        '앰프개선',
        '앰프',
        '차량구입',
        '차량',
        '주일'
    ];

    for (const word of removableWords) {
        if (word) {
            title = title.replace(new RegExp(escapeRegExp(word), 'g'), '');
        }
    }

    title = normalizeKnownName(title.trim()) || cleanCell(record) || '통장입금';

    if (!includesAny(title, ['통장', '이자', '할인', '헌금'])) {
        title = `${title}(통장)`;
    }

    return title;
}

function makeSpendingTitle(transaction) {
    const text = buildTransactionText(transaction);
    const record = transaction.record || transaction.memo || transaction.content || '통장출금';

    if (includesAny(text, ['청양에너지', '충전소', '주유소', 'LPG'])) return '차량 주유비';
    if (includesAny(text, ['대영철물', '예림철물', '철물건재'])) return '철물';
    if (includesAny(text, ['사무용가구', '가구리퍼'])) return '사무용가구';
    if (includesAny(text, ['KB손', '보험료'])) return '보험료';
    if (includesAny(text, ['강내농업협동조합하나로마트', '하나로마트'])) return '하나로마트';
    if (includesAny(text, ['모싯잎송편'])) return '모싯잎송편';
    if (includesAny(text, ['금관유통'])) return '금관마트';
    if (includesAny(text, ['전도용사탕', '전도용품'])) return '전도용품';
    if (includesAny(text, ['6구 스위치'])) return '6구 스위치';
    if (includesAny(text, ['소화기'])) return '소화기2개,폐기물스티커';
    if (includesAny(text, ['전기요금'])) return '전기요금';
    if (includesAny(text, ['수도'])) return '수도료';
    if (includesAny(text, ['전화', 'KT'])) return '전화요금';
    if (includesAny(text, ['퇴직적립'])) return '퇴직적립금';
    if (includesAny(text, ['사회보험'])) return '담임목사 사회보험료';
    if (includesAny(text, ['선교비'])) return record.replace(/([가-힣]{2,4})선교비/g, '$1 선교비').trim();
    if (includesAny(text, ['주일식'])) return '주일 식대 지원';

    return record.trim();
}

function getInternalTransferReason(transaction, accountNumber) {
    const fullText = buildTransactionText(transaction);
    const account = String(accountNumber);

    if (account.startsWith('306') && transaction.withdrawal > 0 && includesAny(fullText, ['만나교회'])) {
        return '306 계좌에서 355 계좌로 옮긴 내부 이체';
    }

    if (account.startsWith('355') && transaction.deposit > 0 && includesAny(fullText, ['기독교대한감리회만나', '만나교회'])) {
        return '306 계좌에서 355 계좌로 들어온 내부 이체';
    }

    return '';
}

function findSimilarExistingRow(transaction, guessed, existingRows) {
    const rawTitle = targetTitleKey(transaction.record || transaction.memo || transaction.content);
    const candidates = existingRows.filter(row => row.date === transaction.date && row.amount === transaction.amount);

    if (rawTitle) {
        const titleMatches = candidates.filter(row => {
            const dbTitle = targetTitleKey(row.title);
            return dbTitle.includes(rawTitle) || rawTitle.includes(dbTitle);
        });

        if (titleMatches.length === 1) {
            return titleMatches[0];
        }
    }

    const subjectMatches = candidates.filter(row => row.account === guessed.account && row.subject === guessed.subject);
    return subjectMatches.length === 1 ? subjectMatches[0] : null;
}

function findExactExistingRow(row, existingRows) {
    return existingRows.find(existing => (
        existing.date === row.date
        && existing.amount === Number(row.amount)
        && existing.account === cleanCell(row.account)
        && existing.subject === cleanCell(row.subject)
        && targetTitleKey(existing.title) === targetTitleKey(row.title)
    ));
}

function normalizeImportRow(row) {
    const date = normalizeBankDate(row?.date);
    const amount = parseWon(row?.amount);
    const account = cleanCell(row?.account);
    const subject = cleanCell(row?.subject);
    const title = cleanCell(row?.title);

    if (!date || !amount || !account || !subject || !title) {
        return null;
    }

    return { date, amount, account, subject, title };
}

function buildLedgerInsertQuery(row, targetType) {
    if (targetType === 'income') {
        return `
            INSERT INTO 수입 (계정, 과목, 이름, 금액, 날짜)
            VALUES ('${escapeSql(row.account)}', '${escapeSql(row.subject)}', '${escapeSql(row.title)}', ${row.amount}, #${row.date}#)
        `;
    }

    const processedDescription = processDescription(row.subject, row.title);
    return `
        INSERT INTO 지출 (계정, 과목, 적요, 금액, 날짜)
        VALUES ('${escapeSql(row.account)}', '${escapeSql(row.subject)}', '${escapeSql(processedDescription)}', ${row.amount}, #${row.date}#)
    `;
}

function isBudgetSubject(account, subject, budgetSubjects) {
    return Array.isArray(budgetSubjects[account]) && budgetSubjects[account].includes(subject);
}

function buildTransactionText(transaction) {
    return [transaction.content, transaction.record, transaction.memo, transaction.branch]
        .map(cleanCell)
        .filter(Boolean)
        .join(' ');
}

function normalizeBankDate(value) {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    }

    const text = cleanCell(value);
    const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (!match) return '';

    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeDbDate(value) {
    if (!value) return '';
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    }

    return normalizeBankDate(value);
}

function parseWon(value) {
    if (value === null || value === undefined || value === '') return 0;
    const number = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) ? Math.round(number) : 0;
}

function cleanCell(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
}

function includesAny(text, words) {
    return words.some(word => cleanCell(text).includes(word));
}

function targetTitleKey(value) {
    return cleanCell(value)
        .replace(/\(통장\)/g, '')
        .replace(/[()\s/_-]/g, '')
        .replace(/헌금/g, '')
        .trim();
}

function normalizeKnownName(value) {
    const normalized = cleanCell(value);
    const compact = normalized.replace(/\s+/g, '');
    const knownNames = {
        허희정신승도: '신승도 허희정',
        신승도허희정: '신승도 허희정',
        박현민이영미: '박현민 이영미',
        남택주이기자: '남택주 이기자',
        문헌주이예은: '문헌주 이예은'
    };

    return knownNames[compact] || normalized;
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeSql(value) {
    return cleanCell(value).replace(/'/g, "''");
}

// Express 설정을 내보냄
module.exports = app;
