# 🖥️ Electron SvelteKit App

A simple **Electron** application built with **SvelteKit** for the frontend and **Express.js** for the backend.

---

## 🚀 Features
- **Electron** for desktop application
- **SvelteKit** for frontend (SPA mode)
- **Express.js** for backend API
- **Built-in routing & state management**
- This project only ensures in a **Windows environment**

---

## 📦 Installation

## **Pre install ACE.OLEDB.12.0 Provider**
### This need for using mdb file

https://www.microsoft.com/ko-kr/download/details.aspx?id=54920/

### 1️⃣ **Clone the Repository**

```sh
git clone https://github.com/onyx-ken/simple-income-expense-management.git
cd simple-income-expense-management
```

### 2️⃣ Install Dependencies

```sh
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

Dependencies, generated builds, caches, IDE metadata, and local database backups are excluded from Git. Install dependencies for all three packages after cloning. Active MDB files and Excel import files remain tracked.

### 3️⃣ Run in Development Mode

```sh
npm run start:dev
```
- This command starts the frontend (SvelteKit), backend (Express.js), and Electron application simultaneously.
- The Electron app window should open automatically.


### 4️⃣ Build for Production

```sh
npm run build
```

- After the build is complete, the executable file (.exe) will be located in the dist_electron/ folder.
- You must place the tre{xxxx}.mdb file in the same location as the .exe executable file.
- Run the .exe file to launch the application.

## 📜 License
### This project is licensed under the MIT License.
