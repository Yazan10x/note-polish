# Note Polish

Note Polish turns messy notes into a clean, one page study sheet you can actually review.
Upload a screenshot or paste text, pick a style, and generate a print ready summary in seconds.

**Demo Video:** [YouTube link](https://youtu.be/U4gpXMrDsnE)

Before and after example (heart notes)
<img width="1147" height="900" alt="image" src="https://github.com/user-attachments/assets/a5659497-e5ee-4df1-928d-27571f45557e" />


Pick from 1 to 5 styles to customize the output
<img width="1400" height="860" alt="dashboard" src="https://github.com/user-attachments/assets/a299242f-a1f4-4d66-87f1-afa7a3d89796" />


## Tech Stack
- Next.js (TypeScript)
- Tailwind + shadcn/ui
- MongoDB (local via Docker)
- OpenAI API

## Run Locally

1) Create your local env file:
```bash
bash ./setup_local.sh
```

Optional: pass your OpenAI key in the command:
```bash
bash ./setup_local.sh sk-your-openai-key
```

2) Start everything:
```bash
bash ./run_local.sh
```

Open:
- http://localhost:3000/

## Environment Variables

Your `.env.local` should include:
```env
OPENAI_API_KEY=your_key_here
MONGODB_URI=mongodb://127.0.0.1:27077
MONGODB_DB=note_polish
```
