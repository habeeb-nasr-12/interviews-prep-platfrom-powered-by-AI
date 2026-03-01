import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
  console.log("Received POST request");

  try {
    const { type, role, level, techstack, amount, userid } =
      await request.json();
    console.log("Parsed request JSON:", {
      type,
      role,
      level,
      techstack,
      amount,
      userid,
    });

    const { text: questions } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Prepare questions for a job interview.
The job role is ${role}.
The job experience level is ${level}.
The tech stack used in the job is: ${techstack}.
The focus between behavioural and technical questions should lean towards: ${type}.
The amount of questions required is: ${amount}.
Please return only the questions, without any additional text.
The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
Return the questions formatted like this:
["Question 1", "Question 2", "Question 3"]

Thank you!`.trim(),
    });
    console.log("Generated questions:", questions);

    const interview = {
      role,
      type,
      level,
      techstack: techstack.split(","),
      questions: JSON.parse(questions),
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };
    console.log("Interview object created:", interview);

    await db.collection("interviews").add(interview);
    console.log("Interview added to database");

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error occurred:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
