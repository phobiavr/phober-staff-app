import client from './client'

export interface EmployeeServiced {
  in_a_day: number
  minutes_in_a_day: number
  in_a_week: number
  minutes_in_a_week: number
  in_a_month: number
  minutes_in_a_month: number
  total: number
  minutes_total: number
}

export interface Employee {
  id: number
  full_name: string
  first_name: string
  last_name: string
  serviced: EmployeeServiced
}

export const getEmployees = () => client.get<Employee[]>('/staff/employees')
