import { of } from 'rxjs';

export class ServiceGroupsProviderMock {
	getAllVirtServiceGroups() {

		return new Promise(function (resolve: Function): void {


			of(
				[
					{
						"id": "75",
						"parent_id": "80",
						"name": "Metro Richmond Committee",
						"description": "",
						"type": "MA",
						"url": "rvana.org",
						"root_server_id": "2",
						"helpline": "8049651871",
						"world_id": "AR57450"
					},
					{
						"id": "76",
						"parent_id": "75",
						"name": "New Dominion Area",
						"description": "New Dominion Area",
						"type": "AS",
						"url": "https://rvana.org",
						"root_server_id": "2",
						"helpline": "8049651871",
						"world_id": "AR57414"
					},
					{
						"id": "1583",
						"parent_id": "1584",
						"name": "CSR Brasil Central",
						"description": "Administra\u00e7\u00e3o dos grupos e CSAs da Regi\u00e3o CSR Brasil Central",
						"type": "RS",
						"url": "https://www.na.org.br/csr/csr_brasil_central_15.html",
						"root_server_id": "58",
						"helpline": "Acre 68 999603014  |  Goi\u00e1s e Mato Grosso 08008886262",
						"world_id": ""
					},
					{
						"id": "223",
						"parent_id": "226",
						"name": "Montco Area",
						"description": "Montco Area Area Service Committee Meeting: Last Sunday of each month at 12:00 PM at 2nd floor, Outpatient Building, Mercy Suburban Hospital, 2701 Dekalb Pike Norristown, PA 19401 Subcommittee Meetings: Last Sunday of each month at 11:00 AM at 2nd floor, Outpatient Building, Mercy Suburban Hospital, 2701 Dekalb Pike Norristown, PA 19401",
						"type": "AS",
						"url": "",
						"root_server_id": "6",
						"helpline": "844-624-3575",
						"world_id": "AR24710"
					}]
			);

		});

	}


	getAllServiceGroups() {
		return of(
			[
				{
					"id": "75",
					"parent_id": "80",
					"name": "Metro Richmond Committee",
					"description": "",
					"type": "MA",
					"url": "rvana.org",
					"root_server_id": "2",
					"helpline": "8049651871",
					"world_id": "AR57450"
				},
				{
					"id": "76",
					"parent_id": "75",
					"name": "New Dominion Area",
					"description": "New Dominion Area",
					"type": "AS",
					"url": "https://rvana.org",
					"root_server_id": "2",
					"helpline": "8049651871",
					"world_id": "AR57414"
				},
				{
					"id": "1583",
					"parent_id": "1584",
					"name": "CSR Brasil Central",
					"description": "Administra\u00e7\u00e3o dos grupos e CSAs da Regi\u00e3o CSR Brasil Central",
					"type": "RS",
					"url": "https://www.na.org.br/csr/csr_brasil_central_15.html",
					"root_server_id": "58",
					"helpline": "Acre 68 999603014  |  Goi\u00e1s e Mato Grosso 08008886262",
					"world_id": ""
				},
				{
					"id": "223",
					"parent_id": "226",
					"name": "Montco Area",
					"description": "Montco Area Area Service Committee Meeting: Last Sunday of each month at 12:00 PM at 2nd floor, Outpatient Building, Mercy Suburban Hospital, 2701 Dekalb Pike Norristown, PA 19401 Subcommittee Meetings: Last Sunday of each month at 11:00 AM at 2nd floor, Outpatient Building, Mercy Suburban Hospital, 2701 Dekalb Pike Norristown, PA 19401",
					"type": "AS",
					"url": "",
					"root_server_id": "6",
					"helpline": "844-624-3575",
					"world_id": "AR24710"
				}]
		);
	}
}