import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // 使用 Supabase admin 客户端查询
    const { getAdminClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 })
    }

    const supabase = getAdminClient()

    // 查询 scenes 表的列信息
    const { data: columns, error } = await supabase
      .rpc('get_table_columns', { 
        table_name: 'scenes' 
      })

    if (error) {
      console.error("[Debug] Column query error:", error)
      // 尝试直接查询表结构
      const { data: sampleRow } = await supabase
        .from("scenes")
        .select("*")
        .limit(1)
        .single()

      if (sampleRow) {
        const columns = Object.keys(sampleRow).map(key => ({
          column_name: key,
          data_type: typeof sampleRow[key],
        }))

        return NextResponse.json({
          table: 'scenes',
          columns,
          sampleRow,
        })
      }
    }

    return NextResponse.json({
      table: 'scenes',
      columns,
    })
  } catch (err: any) {
    console.error("[Debug] Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
