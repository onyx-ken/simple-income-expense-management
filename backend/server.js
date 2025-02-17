const express = require('express');
const ADODB = require('node-adodb');
const path = require('path');

// 1) Express 앱 생성
const app = express();
// JSON 바디 파싱 (POST 요청 시 body에 JSON 받을 수 있게 함)
app.use(express.json());

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

        // 이름 조건
        if (name) {
            queryStr += ` AND 이름 LIKE '%${name}%'`; // LIKE 조건 추가
        }

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

        // 적요 조건
        if (summary) {
            queryStr += ` AND 적요 LIKE '%${summary}%'`; // LIKE 조건 추가
        }

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

// Express 설정을 내보냄
module.exports = app;
