import Agent from "@/components/Agent"
import { getCurrentUser } from "@/lib/actions/auth.action"
export const dynamic = 'force-dynamic';


const page = async () => {
    const user = await getCurrentUser()
    return (
        <div>
            <h3 className="my-3">Interview Generation</h3>
            <Agent userName={user?.name as string} userId={user?.id as string} type="generate" />
        </div>
    )
}

export default page